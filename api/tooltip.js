// api/tooltip.js

// Tooltip control functions
const TooltipAPI = {
    /**
     * Hide tooltip for a specific model by name (overrides 'always' trigger)
     * @param {string} modelName - Name of the model to hide tooltip for
     * @returns {boolean} Success status
     */
    hideTooltip: function(modelName) {
        const model = this._findModelByName(modelName);
        if (!model) {
            console.error(`Model with name "${modelName}" not found`);
            return false;
        }

        const wrapper = this._findTooltipWrapper(model.object);
        if (!wrapper) {
            console.warn(`No tooltip found for model "${modelName}"`);
            return false;
        }

        // Set API override flag and hide immediately
        wrapper.apiOverride = true;
        wrapper.apiHidden = true;
        wrapper.el.style.display = 'none';
        
        console.log(`Tooltip hidden for model: ${modelName} (overriding 'always' trigger)`);
        return true;
    },

    /**
     * Show tooltip for a specific model by name
     * @param {string} modelName - Name of the model to show tooltip for
     * @returns {boolean} Success status
     */
    showTooltip: function(modelName) {
        const model = this._findModelByName(modelName);
        if (!model) {
            console.error(`Model with name "${modelName}" not found`);
            return false;
        }

        if (model.showTooltip === false) {
            console.warn(`Tooltips are disabled for model "${modelName}"`);
            return false;
        }

        const wrapper = this._findTooltipWrapper(model.object);
        if (!wrapper) {
            console.warn(`No tooltip found for model "${modelName}"`);
            return false;
        }

        // Clear API override and show immediately
        wrapper.apiOverride = false;
        wrapper.apiHidden = false;
        wrapper.el.style.display = 'block';
        this._updateTooltipPosition(wrapper.el, model.object);
        
        console.log(`Tooltip shown for model: ${modelName}`);
        return true;
    },

    /**
     * Toggle tooltip visibility for a specific model by name
     * @param {string} modelName - Name of the model to toggle tooltip for
     * @returns {boolean} New visibility state
     */
    toggleTooltip: function(modelName) {
        const model = this._findModelByName(modelName);
        if (!model) {
            console.error(`Model with name "${modelName}" not found`);
            return false;
        }

        const wrapper = this._findTooltipWrapper(model.object);
        if (!wrapper) {
            console.warn(`No tooltip found for model "${modelName}"`);
            return false;
        }

        const isCurrentlyVisible = wrapper.el.style.display === 'block' || wrapper.el.style.display === '';
        
        if (isCurrentlyVisible) {
            this.hideTooltip(modelName);
            return false;
        } else {
            this.showTooltip(modelName);
            return true;
        }
    },

    /**
     * Hide all tooltips (overrides 'always' triggers)
     */
    hideAllTooltips: function() {
        let count = 0;
        this._getTooltipsMap().forEach((wrapper, model) => {
            wrapper.apiOverride = true;
            wrapper.apiHidden = true;
            wrapper.el.style.display = 'none';
            count++;
        });
        console.log(`Hidden ${count} tooltips (overriding 'always' triggers)`);
        return count;
    },

    /**
     * Show all tooltips (respects original trigger settings)
     */
    showAllTooltips: function() {
        let count = 0;
        this._getModelsArray().forEach(model => {
            if (model.showTooltip !== false) {
                const wrapper = this._findTooltipWrapper(model.object);
                if (wrapper) {
                    wrapper.apiOverride = false;
                    wrapper.apiHidden = false;
                    
                    // Show based on original trigger
                    if (wrapper.trigger === 'always') {
                        wrapper.el.style.display = 'block';
                        this._updateTooltipPosition(wrapper.el, model.object);
                        count++;
                    } else {
                        // For non-always triggers, just clear the override
                        wrapper.el.style.display = 'none';
                    }
                }
            }
        });
        console.log(`Shown ${count} tooltips (respecting trigger settings)`);
        return count;
    },

    /**
     * Release API override and let original trigger settings take control
     * @param {string} modelName - Name of the model (optional, if not provided, releases all)
     */
    releaseOverride: function(modelName = null) {
        if (modelName) {
            const model = this._findModelByName(modelName);
            if (!model) {
                console.error(`Model with name "${modelName}" not found`);
                return false;
            }

            const wrapper = this._findTooltipWrapper(model.object);
            if (wrapper) {
                wrapper.apiOverride = false;
                wrapper.apiHidden = false;
                
                // Restore based on original trigger
                if (wrapper.trigger === 'always') {
                    wrapper.el.style.display = 'block';
                    this._updateTooltipPosition(wrapper.el, model.object);
                } else {
                    wrapper.el.style.display = 'none';
                }
                
                console.log(`Released API override for model: ${modelName}`);
                return true;
            }
        } else {
            // Release all overrides
            let count = 0;
            this._getTooltipsMap().forEach((wrapper, model) => {
                wrapper.apiOverride = false;
                wrapper.apiHidden = false;
                
                // Restore based on original trigger
                if (wrapper.trigger === 'always') {
                    wrapper.el.style.display = 'block';
                    this._updateTooltipPosition(wrapper.el, model);
                } else {
                    wrapper.el.style.display = 'none';
                }
                
                count++;
            });
            console.log(`Released API override for ${count} tooltips`);
            return count;
        }
    },

    /**
     * Get tooltip visibility state for a model
     * @param {string} modelName - Name of the model
     * @returns {boolean|null} Visibility state or null if not found
     */
    getTooltipVisibility: function(modelName) {
        const model = this._findModelByName(modelName);
        if (!model) {
            console.error(`Model with name "${modelName}" not found`);
            return null;
        }

        const wrapper = this._findTooltipWrapper(model.object);
        if (!wrapper) {
            console.warn(`No tooltip found for model "${modelName}"`);
            return null;
        }

        return wrapper.el.style.display === 'block' || wrapper.el.style.display === '';
    },

    /**
     * List all models with their tooltip status
     * @returns {Array} Array of model info objects
     */
    listTooltips: function() {
        return this._getModelsArray().map(model => {
            const wrapper = this._findTooltipWrapper(model.object);
            const isVisible = wrapper ? (wrapper.el.style.display === 'block' || wrapper.el.style.display === '') : false;
            
            return {
                name: model.name || model.object.name,
                hasTooltip: !!wrapper,
                visible: isVisible,
                apiOverride: wrapper ? wrapper.apiOverride : false,
                apiHidden: wrapper ? wrapper.apiHidden : false,
                trigger: wrapper ? wrapper.trigger : 'none',
                enabled: model.showTooltip !== false
            };
        });
    },

    /**
     * Patch the animation loop to respect API override for 'always' triggers
     */
    patchAnimationLoop: function() {
        // Store reference to the original animation loop
        const originalAnimate = window.animate;
        
        if (originalAnimate) {
            // Replace the global animate function
            window.animate = function() {
                // Call original animate function
                originalAnimate();
                
                // Our custom tooltip control logic
                const tooltipsMap = window.tooltips || new Map();
                const viewer = window.viewer;
                
                tooltipsMap.forEach((wrapper, model) => {
                    // Skip if API has overridden this tooltip
                    if (wrapper.apiOverride) {
                        if (wrapper.apiHidden) {
                            wrapper.el.style.display = 'none';
                        } else {
                            wrapper.el.style.display = 'block';
                            // Update position
                            const anchor = new THREE.Vector3();
                            model.getWorldPosition(anchor);
                            
                            const tmpProj = anchor.clone().project(viewer.camera);
                            const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
                            const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
                            wrapper.el.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
                        }
                        return; // Skip further processing for API-controlled tooltips
                    }
                    
                    // Original animation logic for non-API-controlled tooltips
                    if (wrapper.trigger === 'always') {
                        wrapper.el.style.display = 'block';
                        const anchor = new THREE.Vector3();
                        model.getWorldPosition(anchor);
                        
                        const tmpProj = anchor.clone().project(viewer.camera);
                        const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
                        const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
                        wrapper.el.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
                    }
                    // Note: hover/click triggers are handled by the original animation logic
                });
            };
            console.log('Animation loop patched for API tooltip control');
        }
    },

    /**
     * Find model by name
     * @private
     */
    _findModelByName: function(modelName) {
        const models = this._getModelsArray();
        return models.find(m => 
            m.name === modelName || 
            m.object.name === modelName ||
            (m.name && m.name.toLowerCase() === modelName.toLowerCase()) ||
            (m.object.name && m.object.name.toLowerCase() === modelName.toLowerCase())
        );
    },

    /**
     * Find tooltip wrapper for a model object
     * @private
     */
    _findTooltipWrapper: function(modelObject) {
        const tooltips = this._getTooltipsMap();
        let current = modelObject;
        while (current) {
            if (tooltips.has(current)) {
                const wrapper = tooltips.get(current);
                // Initialize API control flags if not exists
                if (wrapper.apiOverride === undefined) {
                    wrapper.apiOverride = false;
                }
                if (wrapper.apiHidden === undefined) {
                    wrapper.apiHidden = false;
                }
                return wrapper;
            }
            current = current.parent;
        }
        return null;
    },

    /**
     * Update tooltip position
     * @private
     */
    _updateTooltipPosition: function(tooltipEl, modelObject) {
        try {
            const viewer = this._getViewer();
            if (!viewer || !viewer.camera) return;

            const anchor = new THREE.Vector3();
            modelObject.getWorldPosition(anchor);
            
            const tmpProj = anchor.clone().project(viewer.camera);
            const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
            tooltipEl.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
        } catch (e) {
            console.error('Error updating tooltip position:', e);
        }
    },

    /**
     * Get models array from various possible locations
     * @private
     */
    _getModelsArray: function() {
        if (window.models) return window.models;
        if (window.app && window.app.models) return window.app.models;
        if (window.viewer && window.viewer.models) return window.viewer.models;
        
        console.error('Models array not found');
        return [];
    },

    /**
     * Get tooltips map from various possible locations
     * @private
     */
    _getTooltipsMap: function() {
        if (window.tooltips) return window.tooltips;
        if (window.app && window.app.tooltips) return window.app.tooltips;
        if (window.viewer && window.viewer.tooltips) return window.viewer.tooltips;
        
        console.error('Tooltips map not found');
        return new Map();
    },

    /**
     * Get viewer instance
     * @private
     */
    _getViewer: function() {
        if (window.viewer) return window.viewer;
        if (window.app && window.app.viewer) return window.app.viewer;
        console.error('Viewer not found');
        return null;
    }
};

// Make functions available globally
window.TooltipAPI = TooltipAPI;

// Create global shortcuts
window.hideTooltip = TooltipAPI.hideTooltip.bind(TooltipAPI);
window.showTooltip = TooltipAPI.showTooltip.bind(TooltipAPI);
window.toggleTooltip = TooltipAPI.toggleTooltip.bind(TooltipAPI);
window.hideAllTooltips = TooltipAPI.hideAllTooltips.bind(TooltipAPI);
window.showAllTooltips = TooltipAPI.showAllTooltips.bind(TooltipAPI);
window.releaseTooltipOverride = TooltipAPI.releaseOverride.bind(TooltipAPI);
window.getTooltipVisibility = TooltipAPI.getTooltipVisibility.bind(TooltipAPI);
window.listTooltips = TooltipAPI.listTooltips.bind(TooltipAPI);

console.log('Tooltip API loaded with override capability');
console.log('Available functions: hideTooltip, showTooltip, toggleTooltip, hideAllTooltips, showAllTooltips, releaseTooltipOverride, getTooltipVisibility, listTooltips');

// Auto-initialize and patch
setTimeout(() => {
    if (typeof models !== 'undefined') {
        window.models = models;
        console.log('Models array exposed globally');
    }
    if (typeof tooltips !== 'undefined') {
        window.tooltips = tooltips;
        console.log('Tooltips map exposed globally');
        
        // Initialize API control flags for existing tooltips
        tooltips.forEach(wrapper => {
            if (wrapper.apiOverride === undefined) {
                wrapper.apiOverride = false;
            }
            if (wrapper.apiHidden === undefined) {
                wrapper.apiHidden = false;
            }
        });
    }
    
    TooltipAPI.patchAnimationLoop();
}, 1000);