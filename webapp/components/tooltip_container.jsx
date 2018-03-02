import React from 'react';

import PropTypes from 'prop-types';

import AuthenticationRequiredTooltip from './authentication_required_tooltip.jsx';
import ErrorTooltip from './error_tooltip.jsx';
import PullRequestTooltip from './pull_request_tooltip.jsx';
import LoadingTooltip from './loading_tooltip.jsx';

export default class TooltipContainer extends React.PureComponent {
    static propTypes = {
        anchor: PropTypes.object.isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            error: null,
            isLoaded: false,
            tooltip: {}
        };
    }

    componentDidMount() {
        fetch('/plugins/github-tooltips/tooltip?url=' + encodeURIComponent(this.props.anchor.href), {
            credentials: 'same-origin'
        }).then((res) => res.json()).then(
            (result) => {
                this.setState({
                    isLoaded: true,
                    tooltip: result
                });
            },
            (error) => {
                console.log(error); //eslint-disable-line no-console
                this.setState({
                    isLoaded: true,
                    error
                });
            }
        );
    }

    render() {
        if (!this.state.isLoaded) {
            return <LoadingTooltip/>;
        }

        if (this.state.tooltip) {
            switch (this.state.tooltip.type) {
            case 'AuthenticationRequired':
                return <AuthenticationRequiredTooltip/>;
            case 'PullRequest':
                return (
                    <PullRequestTooltip
                        data={this.state.tooltip.data}
                    />
                );
            }
        }

        return <ErrorTooltip/>;
    }
}
