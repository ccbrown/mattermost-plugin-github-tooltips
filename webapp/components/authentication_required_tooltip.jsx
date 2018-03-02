import React from 'react';

export default class AuthenticationRequiredTooltip extends React.PureComponent {
    render() {
        return (
            <div
                style={{
                    width: '500px'
                }}
            >
                <p>{'Enhanced tooltips can be displayed if you authenticate with GitHub. Type /gh-tooltip-auth to get started.'}</p>
            </div>
        );
    }
}
