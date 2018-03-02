.PHONY: dist clean check-style

all: dist

TAR_PLUGIN_EXE_TRANSFORM = --transform 'flags=r;s|dist/intermediate/plugin_.*|plugin.exe|' --transform 'flags=r;s|dist/intermediate/||'
ifneq (,$(findstring bsdtar,$(shell tar --version)))
	TAR_PLUGIN_EXE_TRANSFORM = -s '|dist/intermediate/plugin_.*|plugin.exe|' -s '|dist/intermediate/||'
endif

check-style: .npminstall
	cd webapp && npm run check

.npminstall: webapp/package.json
	cd webapp && npm install
	touch $@

dist: .npminstall vendor $(shell go list -f '{{range .GoFiles}}{{.}} {{end}}') plugin.yaml
	rm -rf dist

	go get github.com/mitchellh/gox
	$(shell go env GOPATH)/bin/gox -osarch='darwin/amd64 linux/amd64 windows/amd64' -output 'dist/intermediate/plugin_{{.OS}}_{{.Arch}}'

	cd webapp && npm run build
	cp webapp/dist/github_tooltips_bundle.js dist/intermediate/plugin.js
	rm -rf webapp/dist

	tar -czvf dist/mattermost-github-tooltips-plugin-darwin-amd64.tar.gz $(TAR_PLUGIN_EXE_TRANSFORM) dist/intermediate/plugin_darwin_amd64 plugin.yaml dist/intermediate/plugin.js
	tar -czvf dist/mattermost-github-tooltips-plugin-linux-amd64.tar.gz $(TAR_PLUGIN_EXE_TRANSFORM) dist/intermediate/plugin_linux_amd64 plugin.yaml dist/intermediate/plugin.js
	tar -czvf dist/mattermost-github-tooltips-plugin-windows-amd64.tar.gz $(TAR_PLUGIN_EXE_TRANSFORM) dist/intermediate/plugin_windows_amd64.exe plugin.yaml dist/intermediate/plugin.js

clean:
	rm -rf dist
	cd webapp && rm -rf node_modules
	cd webapp && rm -f .npminstall

vendor: glide.lock
	go get github.com/Masterminds/glide
	$(shell go env GOPATH)/bin/glide install
