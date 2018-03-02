import React from 'react';

import PropTypes from 'prop-types';

export default class PullRequestTooltip extends React.PureComponent {
    static propTypes = {
        data: PropTypes.object.isRequired
    }

    render() {
        const org = this.props.data.organization;
        const repo = org.repository;
        const pr = repo.pullRequest;

        const reviewRequests = [];
        for (const node of pr.reviewRequests.nodes) {
            const reviewer = node.requestedReviewer;
            reviewRequests.push((
                <li
                    className='github-user'
                    key={reviewer.login}
                >
                    <img src={reviewer.avatarUrl}/>
                    {reviewer.login}
                </li>
            ));
        }

        const assignees = [];
        for (const node of pr.assignees.nodes) {
            assignees.push((
                <li
                    className='github-user'
                    key={node.login}
                >
                    <img src={node.avatarUrl}/>
                    {node.login}
                </li>
            ));
        }

        const labels = [];
        for (const node of pr.labels.nodes) {
            // See https://www.w3.org/TR/WCAG20/
            const components = [];
            for (var i = 0; i < 3; ++i) {
                var c = parseInt(node.color.substring(i * 2, (i * 2) + 2), 16);
                c /= 255.0;
                if (c <= 0.03928) {
                    c /= 12.92;
                } else {
                    c = Math.pow((c + 0.055) / 1.055, 2.4);
                }
                components.push(c);
            }
            const l = (0.2126 * components[0]) + (0.7152 * components[1]) + (0.0722 * components[2]);
            const textColor = l > 0.179 ? '#000' : '#fff';

            labels.push((
                <li
                    key={node.name}
                >
                    <span
                        className='github-label'
                        style={{
                            backgroundColor: '#' + node.color,
                            color: textColor
                        }}
                    >
                        {node.name}
                    </span>
                </li>
            ));
        }

        const statusChecks = [];
        for (const context of pr.commits.nodes[0].commit.status.contexts) {
            var stateIcon = null;
            switch (context.state) {
            case 'EXPECTED':
                break;
            case 'ERROR':
                break;
            case 'FAILURE':
                stateIcon = (
                    <svg
                        aria-hidden='true'
                        height='16'
                        version='1.1'
                        viewBox='0 0 12 16'
                        width='12'
                        className={'github-red'}
                    >
                        <path
                            fillRule='evenodd'
                            d='M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48z'
                        />
                    </svg>
                );
                break;
            case 'PENDING':
                stateIcon = (
                    <svg
                        aria-hidden='true'
                        height='16'
                        version='1.1'
                        viewBox='0 0 8 16'
                        width='8'
                        className={'github-pending'}
                    >
                        <path
                            fillRule='evenodd'
                            d='M0 8c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z'
                        />
                    </svg>
                );
                break;
            case 'SUCCESS':
                stateIcon = (
                    <svg
                        aria-hidden='true'
                        height='16'
                        version='1.1'
                        viewBox='0 0 12 16'
                        width='12'
                        className={'github-green'}
                    >
                        <path
                            fillRule='evenodd'
                            d='M12 5l-8 8-4-4 1.5-1.5L4 10l6.5-6.5z'
                        />
                    </svg>
                );
                break;
            }
            statusChecks.push((
                <li
                    className={'github-status-check'}
                    key={context.context}
                >
                    {stateIcon}
                    {context.context}
                </li>
            ));
        }

        const assigneesHeader = assignees.length > 0 ? (<th>{'Assignees'}</th>) : null;
        const assigneesBody = assignees.length > 0 ? (<td><ul>{assignees}</ul></td>) : null;

        return (
            <div
                style={{
                    width: '640px'
                }}
            >
                <h1>{pr.title}</h1>
                <p>
                    <span className={'pr-state pr-state-' + pr.state.toLowerCase()}>{pr.state.toLowerCase()}</span>
                    <span className={'github-user'}>{pr.author.login}</span>
                    {' wants to merge into '}
                    <span className={'github-ref'}>{org.login + '/' + repo.name + ':' + pr.baseRef.name}</span>
                </p>
                <table width='100%'>
                    <thead>
                        <tr><th>{'Review Requests'}</th>{assigneesHeader}<th>{'Labels'}</th><th>{'Status Checks'}</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <ul>
                                    {reviewRequests}
                                </ul>
                            </td>
                            {assigneesBody}
                            <td>
                                <ul>
                                    {labels}
                                </ul>
                            </td>
                            <td>
                                <ul>
                                    {statusChecks}
                                </ul>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}
