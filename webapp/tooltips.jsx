import React from 'react';
import ReactDOM from 'react-dom';

import TooltipContainer from './components/tooltip_container.jsx';

import './style.css';

var tooltipContainer = null;

export function initializeTooltips() {
    tooltipContainer = document.createElement('div');
    tooltipContainer.className = 'github-tooltip-container';
    tooltipContainer.style.display = 'none';

    document.body.appendChild(tooltipContainer);

    window.addEventListener('mouseover', (event) => {
        const a = event.target.closest('a');
        if (a && shouldShowTooltip(a.href)) {
            renderTooltip(a);
        } else {
            hideTooltip();
        }
    });

    window.addEventListener('mouseout', (event) => {
        hideTooltip();
    });
}

const githubPullRequestURL = new RegExp('^https://github.com/[A-Za-z0-9_.\\-]+/[A-Za-z0-9_.\\-]+/pull/[0-9]+/?$');

function shouldShowTooltip(href) {
    return githubPullRequestURL.test(href);
}

function hideTooltip() {
    tooltipContainer.style.display = 'none';
    ReactDOM.unmountComponentAtNode(tooltipContainer);
}

function renderTooltip(anchor) {
    tooltipContainer.style.display = 'block';

    const rect = anchor.getBoundingClientRect();
    tooltipContainer.style.position = 'absolute';
    tooltipContainer.style.left = rect.left + ((rect.right - rect.left) / 2) + 'px';
    tooltipContainer.style.top = (rect.top - 10) + 'px';

    ReactDOM.render((
        <TooltipContainer
            anchor={anchor}
        />
    ), tooltipContainer);
}
