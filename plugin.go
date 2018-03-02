package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"regexp"
	"sync/atomic"

	"github.com/gorilla/mux"
	"github.com/labstack/gommon/log"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

type Configuration struct {
	GitHubClientId     string
	GitHubClientSecret string
}

type Plugin struct {
	api           plugin.API
	configuration atomic.Value
	router        *mux.Router
}

func (p *Plugin) OnActivate(api plugin.API) error {
	p.api = api

	var configuration Configuration
	if err := api.LoadPluginConfiguration(&configuration); err != nil {
		return err
	}
	p.configuration.Store(&configuration)

	p.router = mux.NewRouter()
	p.router.HandleFunc("/tooltip", p.serveTooltip).Methods("GET")
	p.router.HandleFunc("/auth-callback", p.completeAuthentication).Methods("GET")

	return api.RegisterCommand(&model.Command{
		Trigger:          "gh-tooltip-auth",
		AutoComplete:     true,
		AutoCompleteDesc: "Authenticates the GitHub Tooltip plugin so you can get enhanced tooltips.",
	})
}

func (p *Plugin) OnConfigurationChange() error {
	var configuration Configuration
	if err := p.api.LoadPluginConfiguration(&configuration); err != nil {
		return err
	}
	p.configuration.Store(&configuration)
	return nil
}

func (p *Plugin) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Mattermost-User-Id") == "" {
		http.Error(w, "please log in", http.StatusForbidden)
		return
	}

	p.router.ServeHTTP(w, r)
}

func (p *Plugin) ExecuteCommand(args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	configuration := p.configuration.Load().(*Configuration)
	if configuration.GitHubClientId == "" || configuration.GitHubClientSecret == "" {
		return &model.CommandResponse{
			Text: "This plugin has not been configured yet. Go poke your administrator.",
		}, nil
	}

	var stateBytes [20]byte
	_, err := rand.Read(stateBytes[:])
	if err != nil {
		return nil, model.NewAppError("ExecuteCommand", "error generating random state", nil, err.Error(), http.StatusInternalServerError)
	}
	state := base64.RawURLEncoding.EncodeToString(stateBytes[:])

	if appErr := p.api.KeyValueStore().Set("gh-auth-state:"+args.UserId, []byte(state)); appErr != nil {
		return nil, appErr
	}

	destination, _ := url.Parse("https://github.com/login/oauth/authorize")
	query := url.Values{
		"client_id": {configuration.GitHubClientId},
		"scope":     {"repo,read:org,read:user,read:discussion"},
		"state":     {state},
	}
	destination.RawQuery = query.Encode()

	return &model.CommandResponse{
		GotoLocation: destination.String(),
	}, nil
}

var githubPullRequestURL = regexp.MustCompile(`^https://github.com/([A-Za-z0-9_.\-]+)/([A-Za-z0-9_.\-]+)/pull/([0-9]+)/?$`)

func (p *Plugin) githubGraphQLQuery(userId, query string) (interface{}, error, int) {
	accessTokenBytes, appErr := p.api.KeyValueStore().Get("gh-access-token:" + userId)
	if appErr != nil {
		return nil, appErr, http.StatusInternalServerError
	} else if accessTokenBytes == nil {
		return nil, nil, http.StatusForbidden
	}

	requestPayload := struct {
		Query string `json:"query"`
	}{
		Query: query,
	}
	requestJSON, err := json.Marshal(&requestPayload)
	if err != nil {
		return nil, err, http.StatusInternalServerError
	}

	req, err := http.NewRequest("POST", "https://api.github.com/graphql", bytes.NewReader(requestJSON))
	req.Header.Set("Authorization", "bearer "+string(accessTokenBytes))
	if err != nil {
		return nil, err, http.StatusInternalServerError
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err, http.StatusInternalServerError
	}
	defer resp.Body.Close()

	var responsePayload struct {
		Data   interface{} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&responsePayload); err != nil {
		return nil, err, http.StatusInternalServerError
	}

	for _, err := range responsePayload.Errors {
		log.Error(err.Message)
	}

	if responsePayload.Data == nil {
		return nil, nil, http.StatusInternalServerError
	}

	return responsePayload.Data, nil, http.StatusOK
}

type Tooltip struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

func (p *Plugin) serveTooltip(w http.ResponseWriter, r *http.Request) {
	userId := r.Header.Get("Mattermost-User-Id")

	var tooltip Tooltip

	linkURL := r.URL.Query().Get("url")

	if match := githubPullRequestURL.FindStringSubmatch(linkURL); match != nil {
		data, err, code := p.githubGraphQLQuery(userId, fmt.Sprintf(`{
		  organization(login: "%s") {
			login
			repository(name: "%s") {
			  name
			  pullRequest(number: %s) {
				author {
				  avatarUrl
				  login
				}
				baseRef {
				  name
				}
				commits(last: 1) {
				  nodes {
					commit {
					  status {
						contexts {
						  context
						  state
						}
					  }
					}
				  }
				}
				labels(first: 100) {
				  nodes {
					color
					name
				  }
				}
				reviewRequests(first: 100) {
				  nodes {
					requestedReviewer {
					  ... on User {
						avatarUrl
						login
					  }
					}
				  }
				}
				state
				title
			  }
			}
		  }
		}`, match[1], match[2], match[3]))
		if code == http.StatusForbidden {
			tooltip.Type = "AuthenticationRequired"
		} else if code != http.StatusOK {
			if err != nil {
				log.Error(err)
			}
			http.Error(w, "", code)
			return
		} else {
			tooltip.Type = "PullRequest"
			tooltip.Data = data
		}
	}

	if tooltip.Type != "" {
		json.NewEncoder(w).Encode(&tooltip)
	} else {
		http.NotFound(w, r)
	}
}

func (p *Plugin) completeAuthentication(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	userId := r.Header.Get("Mattermost-User-Id")

	expectedState, appErr := p.api.KeyValueStore().Get("gh-auth-state:" + userId)
	if appErr != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if code == "" || state == "" || expectedState == nil || state != string(expectedState) {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	configuration := p.configuration.Load().(*Configuration)
	resp, err := http.PostForm("https://github.com/login/oauth/access_token", url.Values{
		"client_id":     {configuration.GitHubClientId},
		"client_secret": {configuration.GitHubClientSecret},
		"code":          {code},
		"state":         {state},
	})
	if err != nil {
		http.Error(w, "oauth request error. please try again", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, "oauth request error. please try again", http.StatusInternalServerError)
		return
	}

	resultBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "error reading oauth response. please try again", http.StatusInternalServerError)
		return
	}

	result, err := url.ParseQuery(string(resultBytes))
	if err != nil || result.Get("access_token") == "" {
		http.Error(w, "error parsing oauth response. please try again", http.StatusInternalServerError)
		return
	}

	if appErr := p.api.KeyValueStore().Set("gh-access-token:"+userId, []byte(result.Get("access_token"))); appErr != nil {
		http.Error(w, "error storing access token. please try again", http.StatusInternalServerError)
		return
	}

	fmt.Fprint(w, "Authentication complete. You may now close this page and return to Mattermost.")
}

func main() {
	rpcplugin.Main(&Plugin{})
}
