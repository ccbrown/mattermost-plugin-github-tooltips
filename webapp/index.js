import {initializeTooltips} from './tooltips.jsx';

class PluginClass {
    initialize(registerComponents, store) {
        initializeTooltips();
    }
}

global.window.plugins['github-tooltips'] = new PluginClass();
