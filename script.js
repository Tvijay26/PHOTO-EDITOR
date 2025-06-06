document.addEventListener('DOMContentLoaded', function() {
    // Initialize Fabric.js canvas
    const canvas = new fabric.Canvas('main-canvas', {
        backgroundColor: '#ffffff',
        preserveObjectStacking: true
    });

    // App state
    const state = {
        currentTool: 'select',
        activeLayer: null,
        originalImage: null,
        filters: {},
        zoom: 100,
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        brushSize: 5,
        brushColor: '#000000',
        eraserSize: 20,
        drawingObjects: []
    };

    // DOM elements
    const fileInput = document.getElementById('file-input');
    const newProjectBtn = document.getElementById('new-project');
    const openFileBtn = document.getElementById('open-file');
    const saveFileBtn = document.getElementById('save-file');
    const addLayerBtn = document.getElementById('add-layer');
    const canvasContainer = document.querySelector('.canvas-container');
    const cursorPosition = document.getElementById('cursor-position');
    const zoomLevel = document.getElementById('zoom-level');
    const imageDimensions = document.getElementById('image-dimensions');
    const toolButtons = document.querySelectorAll('.tool-btn');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const adjustmentSliders = document.querySelectorAll('#adjustments input[type="range"]');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const filterIntensityGroup = document.getElementById('filter-intensity-group');
    const filterIntensity = document.getElementById('filter-intensity');
    const effectSliders = document.querySelectorAll('#effects input[type="range"]');
    const applyLutBtn = document.getElementById('apply-lut');
    const lutPresets = document.querySelectorAll('.lut-preset');

    // Initialize canvas with default size
    resizeCanvas(800, 600);

    // Event listeners
    openFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    newProjectBtn.addEventListener('click', createNewProject);
    saveFileBtn.addEventListener('click', saveImage);
    addLayerBtn.addEventListener('click', addNewLayer);

    // Tool selection
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            toolButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentTool = btn.dataset.tool;
            updateCursor();
        });
    });

    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            tabContents.forEach(content => content.classList.remove('active'));
            const tabId = btn.dataset.tab;
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Adjustment sliders
    adjustmentSliders.forEach(slider => {
        slider.addEventListener('input', () => {
            applyAdjustments();
        });
    });

    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterName = btn.dataset.filter;
            
            if (state.filters[filterName]) {
                delete state.filters[filterName];
                btn.classList.remove('active');
            } else {
                state.filters[filterName] = { intensity: 50 };
                btn.classList.add('active');
            }
            
            if (Object.keys(state.filters).length > 0) {
                filterIntensityGroup.style.display = 'block';
            } else {
                filterIntensityGroup.style.display = 'none';
            }
            
            applyFilters();
        });
    });

    // Filter intensity
    filterIntensity.addEventListener('input', applyFilters);

    // Effect sliders
    effectSliders.forEach(slider => {
        slider.addEventListener('input', () => {
            applyEffects();
        });
    });

    // LUT presets
    lutPresets.forEach(preset => {
        preset.addEventListener('click', () => {
            applyLut(preset.dataset.lut);
        });
    });

    // Canvas events
    canvas.on('mouse:move', handleCanvasMouseMove);
    canvas.on('mouse:down', handleCanvasMouseDown);
    canvas.on('mouse:up', handleCanvasMouseUp);
    canvas.on('object:selected', handleObjectSelected);
    canvas.on('selection:cleared', handleSelectionCleared);

    // Window resize
    window.addEventListener('resize', centerCanvas);

    // Functions
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            fabric.Image.fromURL(event.target.result, function(img) {
                canvas.clear();
                canvas.add(img);
                canvas.setActiveObject(img);
                img.set({
                    left: canvas.width / 2 - img.width / 2,
                    top: canvas.height / 2 - img.height / 2,
                    selectable: true
                });
                
                // Store original image
                state.originalImage = img;
                
                // Update dimensions display
                updateImageDimensions(img.width, img.height);
                
                // Center canvas
                centerCanvas();
            });
        };
        reader.readAsDataURL(file);
    }

    function createNewProject() {
        const width = prompt('Enter canvas width (px):', '800');
        const height = prompt('Enter canvas height (px):', '600');
        
        if (width && height) {
            resizeCanvas(parseInt(width), parseInt(height));
            canvas.clear();
            canvas.backgroundColor = '#ffffff';
            canvas.renderAll();
            
            // Reset state
            state.originalImage = null;
            state.filters = {};
            
            // Reset UI
            resetAdjustments();
            filterButtons.forEach(btn => btn.classList.remove('active'));
            filterIntensityGroup.style.display = 'none';
            
            updateImageDimensions(width, height);
        }
    }

    function saveImage() {
        if (!canvas.toDataURL()) return;
        
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = canvas.toDataURL({
            format: 'png',
            quality: 1
        });
        link.click();
    }

    function addNewLayer() {
        const layersContainer = document.querySelector('.layers-container');
        const layerCount = document.querySelectorAll('.layer').length;
        const newLayer = document.createElement('div');
        newLayer.className = 'layer';
        newLayer.innerHTML = `
            <span>Layer ${layerCount + 1}</span>
            <div class="layer-actions">
                <button class="layer-btn"><i class="fas fa-eye"></i></button>
                <button class="layer-btn"><i class="fas fa-lock"></i></button>
            </div>
        `;
        layersContainer.appendChild(newLayer);
    }

    function applyAdjustments() {
        const brightness = parseInt(document.getElementById('brightness').value) / 100;
        const contrast = parseInt(document.getElementById('contrast').value) / 100;
        const saturation = parseInt(document.getElementById('saturation').value) / 100;
        const hue = parseInt(document.getElementById('hue').value);
        const exposure = parseInt(document.getElementById('exposure').value) / 100;

        if (!state.originalImage) return;

        // Create a copy of the original image to apply filters
        const img = state.originalImage;
        
        // Remove existing filters
        img.filters = [];
        
        // Apply new filters
        if (brightness !== 0) {
            img.filters.push(new fabric.Image.filters.Brightness({
                brightness: brightness
            }));
        }
        
        if (contrast !== 0) {
            img.filters.push(new fabric.Image.filters.Contrast({
                contrast: contrast
            }));
        }
        
        if (saturation !== 0) {
            img.filters.push(new fabric.Image.filters.Saturation({
                saturation: 1 + saturation
            }));
        }
        
        if (hue !== 0) {
            img.filters.push(new fabric.Image.filters.HueRotation({
                rotation: hue
            }));
        }
        
        // Exposure is implemented as a combination of brightness and contrast
        if (exposure !== 0) {
            img.filters.push(new fabric.Image.filters.Brightness({
                brightness: exposure
            }));
            img.filters.push(new fabric.Image.filters.Contrast({
                contrast: exposure
            }));
        }
        
        // Apply filters and render
        img.applyFilters();
        canvas.renderAll();
    }

    function applyFilters() {
        if (!state.originalImage) return;

        const intensity = parseInt(filterIntensity.value) / 100;
        const img = state.originalImage;
        
        // Remove existing filters first (except adjustments)
        img.filters = img.filters.filter(f => 
            f.type === 'Brightness' || 
            f.type === 'Contrast' || 
            f.type === 'Saturation' || 
            f.type === 'HueRotation'
        );
        
        // Apply selected filters
        Object.keys(state.filters).forEach(filterName => {
            switch(filterName) {
                case 'blur':
                    img.filters.push(new fabric.Image.filters.Blur({
                        blur: intensity * 2
                    }));
                    break;
                case 'sharpen':
                    // Fabric.js doesn't have a sharpen filter, we can use convolution
                    img.filters.push(new fabric.Image.filters.Convolute({
                        matrix: [ 0, -1,  0,
                                 -1,  5, -1,
                                  0, -1,  0 ]
                    }));
                    break;
                case 'grayscale':
                    img.filters.push(new fabric.Image.filters.Grayscale());
                    break;
                case 'sepia':
                    img.filters.push(new fabric.Image.filters.Sepia());
                    break;
                case 'invert':
                    img.filters.push(new fabric.Image.filters.Invert());
                    break;
                case 'noise':
                    img.filters.push(new fabric.Image.filters.Noise({
                        noise: intensity * 500
                    }));
                    break;
                case 'pixelate':
                    img.filters.push(new fabric.Image.filters.Pixelate({
                        blocksize: 4 + Math.floor(intensity * 16)
                    }));
                    break;
                case 'edge':
                    img.filters.push(new fabric.Image.filters.Convolute({
                        matrix: [ -1, -1, -1,
                                 -1,  8, -1,
                                 -1, -1, -1 ]
                    }));
                    break;
            }
        });
        
        img.applyFilters();
        canvas.renderAll();
    }

    function applyEffects() {
        const vignetteValue = parseInt(document.getElementById('vignette').value) / 100;
        const grainValue = parseInt(document.getElementById('grain').value) / 100;
        const vibranceValue = parseInt(document.getElementById('vibrance').value) / 100;

        // TODO: Implement these effects (would require custom filters)
        console.log('Effects would be applied here:', { vignetteValue, grainValue, vibranceValue });
    }

    function applyLut(lutName) {
        // TODO: Implement LUT application (would require custom filter)
        console.log('LUT would be applied:', lutName);
    }

    function resetAdjustments() {
        document.getElementById('brightness').value = 0;
        document.getElementById('contrast').value = 0;
        document.getElementById('saturation').value = 0;
        document.getElementById('hue').value = 0;
        document.getElementById('exposure').value = 0;
    }

    function resizeCanvas(width, height) {
        canvas.setWidth(width);
        canvas.setHeight(height);
        centerCanvas();
    }

    function centerCanvas() {
        const container = canvasContainer.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        canvasContainer.style.position = 'absolute';
        canvasContainer.style.left = `${(containerWidth - canvas.width) / 2}px`;
        canvasContainer.style.top = `${(containerHeight - canvas.height) / 2}px`;
    }

    function updateCursor() {
        switch (state.currentTool) {
            case 'select':
                canvas.defaultCursor = 'default';
                break;
            case 'crop':
                canvas.defaultCursor = 'crosshair';
                break;
            case 'brush':
                canvas.defaultCursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${state.brushSize}" height="${state.brushSize}" viewBox="0 0 ${state.brushSize} ${state.brushSize}"><circle cx="${state.brushSize/2}" cy="${state.brushSize/2}" r="${state.brushSize/2}" fill="${state.brushColor.replace('#', '%23')}"/></svg>') ${state.brushSize/2} ${state.brushSize/2}, auto`;
                break;
            case 'eraser':
                canvas.defaultCursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${state.eraserSize}" height="${state.eraserSize}" viewBox="0 0 ${state.eraserSize} ${state.eraserSize}"><rect width="${state.eraserSize}" height="${state.eraserSize}" fill="white" stroke="black" stroke-width="1"/></svg>') ${state.eraserSize/2} ${state.eraserSize/2}, auto`;
                break;
            default:
                canvas.defaultCursor = 'default';
        }
        canvas.renderAll();
    }

    function handleCanvasMouseMove(e) {
        const pointer = canvas.getPointer(e.e);
        cursorPosition.textContent = `X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`;
        
        if (state.isDrawing && state.currentTool === 'brush') {
            const path = new fabric.Path(`M ${state.lastX} ${state.lastY} L ${pointer.x} ${pointer.y}`, {
                stroke: state.brushColor,
                strokeWidth: state.brushSize,
                fill: null,
                selectable: false
            });
            canvas.add(path);
            state.drawingObjects.push(path);
            state.lastX = pointer.x;
            state.lastY = pointer.y;
        }
        else if (state.isDrawing && state.currentTool === 'eraser') {
            const objects = canvas.getObjects();
            for (const obj of objects) {
                if (obj.containsPoint(pointer)) {
                    canvas.remove(obj);
                }
            }
        }
    }

    function handleCanvasMouseDown(e) {
        const pointer = canvas.getPointer(e.e);
        state.lastX = pointer.x;
        state.lastY = pointer.y;
        state.isDrawing = true;
        
        switch (state.currentTool) {
            case 'brush':
                const circle = new fabric.Circle({
                    left: pointer.x,
                    top: pointer.y,
                    radius: state.brushSize / 2,
                    fill: state.brushColor,
                    selectable: false
                });
                canvas.add(circle);
                state.drawingObjects.push(circle);
                break;
            case 'text':
                addText(pointer.x, pointer.y);
                break;
            case 'shape':
                addShape(pointer.x, pointer.y);
                break;
            case 'crop':
                startCrop(pointer.x, pointer.y);
                break;
        }
    }

    function handleCanvasMouseUp() {
        state.isDrawing = false;
        
        // Group drawing objects if we were drawing
        if (state.currentTool === 'brush' && state.drawingObjects.length > 0) {
            const group = new fabric.Group(state.drawingObjects, {
                selectable: true
            });
            canvas.remove(...state.drawingObjects);
            canvas.add(group);
            state.drawingObjects = [];
        }
    }

    function handleObjectSelected(e) {
        // Show properties of selected object
        console.log('Object selected:', e.target);
    }

    function handleSelectionCleared() {
        // Clear selection
        console.log('Selection cleared');
    }

    function addText(x, y) {
        const text = new fabric.IText('Double click to edit', {
            left: x,
            top: y,
            fontFamily: 'Arial',
            fill: '#000000',
            fontSize: 20,
            selectable: true
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
    }

    function addShape(x, y) {
        const shape = new fabric.Rect({
            left: x,
            top: y,
            width: 100,
            height: 100,
            fill: '#3498db',
            stroke: '#2980b9',
            strokeWidth: 2,
            selectable: true
        });
        canvas.add(shape);
        canvas.setActiveObject(shape);
    }

    function startCrop(x, y) {
        const rect = new fabric.Rect({
            left: x,
            top: y,
            width: 1,
            height: 1,
            fill: 'rgba(0,0,0,0.3)',
            stroke: '#000000',
            strokeWidth: 1,
            selectable: false,
            hasControls: false,
            hasBorders: false
        });
        canvas.add(rect);
        
        // Track crop rectangle
        state.cropRect = rect;
        state.cropStartX = x;
        state.cropStartY = y;
    }

    function updateImageDimensions(width, height) {
        imageDimensions.textContent = `${width} x ${height} px`;
    }

    // Initialize
    centerCanvas();
    updateCursor();
});
// Add these to your state object
const state = {
    // ... existing state properties ...
    cropMode: false,
    currentPreset: null
};

// Add these DOM elements
const flipHorizontalBtn = document.getElementById('flip-horizontal');
const flipVerticalBtn = document.getElementById('flip-vertical');
const rotateLeftBtn = document.getElementById('rotate-left');
const rotateRightBtn = document.getElementById('rotate-right');
const resetImageBtn = document.getElementById('reset-image');
const opacitySlider = document.getElementById('opacity');
const blendModeSelect = document.getElementById('blend-mode');
const colorOverlay = document.getElementById('color-overlay');
const colorOverlayOpacity = document.getElementById('color-overlay-opacity');
const presetElements = document.querySelectorAll('.preset');

// Add these event listeners
flipHorizontalBtn.addEventListener('click', flipHorizontal);
flipVerticalBtn.addEventListener('click', flipVertical);
rotateLeftBtn.addEventListener('click', rotateLeft);
rotateRightBtn.addEventListener('click', rotateRight);
resetImageBtn.addEventListener('click', resetImage);
opacitySlider.addEventListener('input', updateOpacity);
blendModeSelect.addEventListener('change', updateBlendMode);
colorOverlay.addEventListener('input', updateColorOverlay);
colorOverlayOpacity.addEventListener('input', updateColorOverlay);
presetElements.forEach(preset => {
    preset.addEventListener('click', applyPreset);
});

// Image Editing Functions
function flipHorizontal() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.set('flipX', !activeObject.flipX);
        canvas.renderAll();
    }
}

function flipVertical() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.set('flipY', !activeObject.flipY);
        canvas.renderAll();
    }
}

function rotateLeft() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.rotate(activeObject.angle - 15);
        canvas.renderAll();
    }
}

function rotateRight() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.rotate(activeObject.angle + 15);
        canvas.renderAll();
    }
}

function resetImage() {
    if (state.originalImage) {
        // Remove all filters
        state.originalImage.filters = [];
        state.originalImage.applyFilters();
        
        // Reset transformations
        state.originalImage.set({
            flipX: false,
            flipY: false,
            angle: 0,
            opacity: 1,
            blendMode: 'normal'
        });
        
        // Reset UI controls
        opacitySlider.value = 100;
        blendModeSelect.value = 'normal';
        colorOverlayOpacity.value = 0;
        resetAdjustments();
        
        canvas.renderAll();
    }
}

function updateOpacity() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.set('opacity', opacitySlider.value / 100);
        canvas.renderAll();
    }
}

function updateBlendMode() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.set('blendMode', blendModeSelect.value);
        canvas.renderAll();
    }
}

function updateColorOverlay() {
    if (!state.originalImage) return;
    
    // Remove existing color overlay filter if it exists
    state.originalImage.filters = state.originalImage.filters.filter(
        f => f.type !== 'BlendColor'
    );
    
    const opacity = colorOverlayOpacity.value / 100;
    if (opacity > 0) {
        state.originalImage.filters.push(new fabric.Image.filters.BlendColor({
            color: colorOverlay.value,
            mode: 'tint',
            alpha: opacity
        }));
    }
    
    state.originalImage.applyFilters();
    canvas.renderAll();
}

function applyPreset(e) {
    const preset = e.currentTarget.dataset.preset;
    state.currentPreset = preset;
    
    if (!state.originalImage) return;
    
    // Reset first
    resetImage();
    
    // Apply preset-specific adjustments
    switch(preset) {
        case 'vintage':
            document.getElementById('saturation').value = -30;
            document.getElementById('brightness').value = 10;
            document.getElementById('contrast').value = 10;
            document.getElementById('vignette').value = 70;
            state.filters = { sepia: { intensity: 50 }, noise: { intensity: 20 } };
            break;
        case 'dramatic':
            document.getElementById('contrast').value = 40;
            document.getElementById('brightness').value = -10;
            document.getElementById('vibrance').value = -20;
            state.filters = { sharpen: { intensity: 30 } };
            break;
        case 'portrait':
            document.getElementById('brightness').value = 15;
            document.getElementById('contrast').value = 20;
            document.getElementById('saturation').value = -10;
            state.filters = { blur: { intensity: 10 } };
            break;
        case 'cool':
            document.getElementById('hue').value = 15;
            document.getElementById('saturation').value = 20;
            document.getElementById('vibrance').value = 30;
            state.filters = { grayscale: { intensity: 10 } };
            break;
    }
    
    // Update UI
    filterButtons.forEach(btn => {
        const filterName = btn.dataset.filter;
        if (state.filters[filterName]) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    if (Object.keys(state.filters).length > 0) {
        filterIntensityGroup.style.display = 'block';
    } else {
        filterIntensityGroup.style.display = 'none';
    }
    
    // Apply the changes
    applyAdjustments();
    applyFilters();
    applyEffects();
}

// Update the handleFileUpload function to set initial properties
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        fabric.Image.fromURL(event.target.result, function(img) {
            canvas.clear();
            canvas.add(img);
            canvas.setActiveObject(img);
            img.set({
                left: canvas.width / 2 - img.width / 2,
                top: canvas.height / 2 - img.height / 2,
                selectable: true,
                opacity: 1,
                blendMode: 'normal'
            });
            
            // Store original image
            state.originalImage = img;
            
            // Update dimensions display
            updateImageDimensions(img.width, img.height);
            
            // Center canvas
            centerCanvas();
            
            // Reset all controls
            resetImage();
        });
    };
    reader.readAsDataURL(file);
}