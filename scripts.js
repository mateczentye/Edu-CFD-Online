console.log("The scripts.js file has been loaded successfully! ✅");
document.addEventListener('DOMContentLoaded', () => {
      // --- Canvas and Drawing Setup ---
      const canvas = document.getElementById('drawing-canvas');
      const ctx = canvas.getContext('2d');
      const lineWidth = document.getElementById('lineWidth');
      const clearBtn = document.getElementById('clear-btn');
      const toolBtns = document.querySelectorAll('.tool-btn');
      const fillShapeCheckbox = document.getElementById('fill-shape-checkbox');
      let isDrawing = false;
      let currentTool = 'freehand';
      let startX, startY;
      let snapshot = null; // To hold the canvas state before drawing a new shape

      // --- Simulation Setup ---
      const startSimBtn = document.getElementById('start-sim-btn');
      const stopSimBtn = document.getElementById('stop-sim-btn');
      const simStatus = document.getElementById('sim-status');
      const saveImageBtn = document.getElementById('save-image-btn');
      
      // Domain
      const gridSizeSlider = document.getElementById('grid-size');
      const gridSizeValue = document.getElementById('grid-size-value');
      
      // Fluid
      const inletVelocitySlider = document.getElementById('inlet-velocity');
      const velocityValueSpan = document.getElementById('velocity-value');
      const minVelocityInput = document.getElementById('min-velocity');
      const maxVelocityInput = document.getElementById('max-velocity');

      // Visualization
      const showQuiversCheckbox = document.getElementById('show-quivers');
      showQuiversCheckbox.disabled = true
      const quiverDensitySlider = document.getElementById('quiver-density');
      const quiverScaleSlider = document.getElementById('quiver-scale');
      const showPressureCheckbox = document.getElementById('show-pressure');
      showPressureCheckbox.disabled = true

      let simRunning = false;
      let animationFrameId;

      // --- LBM Simulation Constants and Variables ---
      let simWidth = parseInt(gridSizeSlider.value);
      let simHeight; 
      const tau = 0.6; // Relaxation time (related to viscosity)
      
      const weights = [4/9, 1/9, 1/9, 1/9, 1/9, 1/36, 1/36, 1/36, 1/36];
      const cx = [0, 1, 0, -1, 0, 1, -1, -1, 1];
      const cy = [0, 0, 1, 0, -1, 1, 1, -1, -1];
      
      let f, f_eq, f_new, rho, ux, uy, isBoundary;

      // --- Main Setup ---
      function setup() {
        resizeCanvas();
        initializeSimulationState();
        setupEventListeners();
      }

      function resizeCanvas() {
        const oldImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = Math.round(parent.clientWidth / 2.5);

        // FIX: Prevent division by zero if canvas has no width on initial load.
        if (canvas.width > 0) {
          simHeight = Math.round(simWidth * (canvas.height / canvas.width));
        } else {
          simHeight = 0;
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = oldImageData.width;
        tempCanvas.height = oldImageData.height;
        tempCanvas.getContext('2d').putImageData(oldImageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (!simRunning) {
          initializeSimulationState();
        }
      }

      function initializeSimulationState() {
        rho = new Array(simWidth * simHeight).fill(1.0);
        ux = new Array(simWidth * simHeight).fill(0.0);
        uy = new Array(simWidth * simHeight).fill(0.0);
        isBoundary = new Array(simWidth * simHeight).fill(false);

        f = new Array(simWidth * simHeight * 9);
        f_eq = new Array(simWidth * simHeight * 9);
        f_new = new Array(simWidth * simHeight * 9);
        
        for (let j = 0; j < simHeight; j++) {
          for (let i = 0; i < simWidth; i++) {
            const idx = j * simWidth + i;
            for (let k = 0; k < 9; k++) {
              const u_dot_c = ux[idx] * cx[k] + uy[idx] * cy[k];
              const u_sq = ux[idx] * ux[idx] + uy[idx] * uy[idx];
              const eq = rho[idx] * weights[k] * (1 + 3 * u_dot_c + 4.5 * u_dot_c * u_dot_c - 1.5 * u_sq);
              f[idx * 9 + k] = eq;
            }
          }
        }
      }
      
      // --- Drawing Logic ---
      const getMousePos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      };
      
      const startDrawing = (e) => {
        if (simRunning) return;
        e.preventDefault();
        isDrawing = true;
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;
        
        if (currentTool !== 'freehand') {
          snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } else {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
        }
      };

      const draw = (e) => {
        if (!isDrawing || simRunning) return;
        e.preventDefault();
        const pos = getMousePos(e);
        const fill = fillShapeCheckbox.checked;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "black";
        ctx.lineWidth = lineWidth.value;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (currentTool === 'freehand') {
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.putImageData(snapshot, 0, 0);
          ctx.beginPath();

          if (currentTool === 'rectangle') {
            const width = pos.x - startX;
            const height = pos.y - startY;
            if (fill) {
              ctx.fillRect(startX, startY, width, height);
            } else {
              ctx.strokeRect(startX, startY, width, height);
            }
          } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            if (fill) {
              ctx.fill();
            } else {
              ctx.stroke();
            }
          }
        }
      };

      const stopDrawing = (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (currentTool !== 'freehand') {
          // Re-draw the final shape to ensure it's "baked in"
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.putImageData(snapshot, 0, 0);
          ctx.beginPath();
          const fill = fillShapeCheckbox.checked;
          ctx.strokeStyle = "black";
          ctx.fillStyle = "black";
          ctx.lineWidth = lineWidth.value;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          const pos = getMousePos(e);
          if (currentTool === 'rectangle') {
            const width = pos.x - startX;
            const height = pos.y - startY;
            if (fill) {
              ctx.fillRect(startX, startY, width, height);
            } else {
              ctx.strokeRect(startX, startY, width, height);
            }
          } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            if (fill) {
              ctx.fill();
            } else {
              ctx.stroke();
            }
          }
        }
        ctx.closePath();
        updateBoundariesFromCanvas();
      };
      
      function updateBoundariesFromCanvas() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const scaleX = simWidth / canvas.width;
        const scaleY = simHeight / canvas.height;

        for (let j = 0; j < simHeight; j++) {
          for (let i = 0; i < simWidth; i++) {
            const canvasX = Math.floor(i / scaleX);
            const canvasY = Math.floor(j / scaleY);
            const pixelIndex = (canvasY * canvas.width + canvasX) * 4;
            const simIdx = j * simWidth + i;
            isBoundary[simIdx] = imageData[pixelIndex + 3] > 0;
          }
        }
      }
      
      // --- Simulation Logic (LBM) ---
      function simulationStep() {
        const inletVel = parseFloat(inletVelocitySlider.value);
        
        // Collision
        for (let j = 0; j < simHeight; j++) {
          for (let i = 0; i < simWidth; i++) {
            const idx = j * simWidth + i;
            let current_rho = 0, current_ux = 0, current_uy = 0;
            for (let k = 0; k < 9; k++) {
              current_rho += f[idx * 9 + k];
              current_ux += f[idx * 9 + k] * cx[k];
              current_uy += f[idx * 9 + k] * cy[k];
            }
            current_ux /= current_rho;
            current_uy /= current_rho;
            rho[idx] = current_rho;
            ux[idx] = current_ux;
            uy[idx] = current_uy;

            for (let k = 0; k < 9; k++) {
              const u_dot_c = current_ux * cx[k] + current_uy * cy[k];
              const u_sq = current_ux * current_ux + current_uy * current_uy;
              f_eq[idx * 9 + k] = current_rho * weights[k] * (1 + 3 * u_dot_c + 4.5 * u_dot_c * u_dot_c - 1.5 * u_sq);
              f_new[idx * 9 + k] = f[idx * 9 + k] - (1 / tau) * (f[idx * 9 + k] - f_eq[idx * 9 + k]);
            }
          }
        }

        // Streaming and Boundary Conditions
        for (let j = 0; j < simHeight; j++) {
          for (let i = 0; i < simWidth; i++) {
            const idx = j * simWidth + i;
            if (isBoundary[idx]) continue;
            for (let k = 0; k < 9; k++) {
              const prev_i = i - cx[k];
              const prev_j = j - cy[k];
              if (prev_i >= 0 && prev_i < simWidth && prev_j >= 0 && prev_j < simHeight) {
                const prev_idx = prev_j * simWidth + prev_i;
                if(isBoundary[prev_idx]) {
                  const opposite_k = (k === 1) ? 3 : (k === 3) ? 1 : (k === 2) ? 4 : (k === 4) ? 2 : (k === 5) ? 7 : (k === 7) ? 5 : (k === 6) ? 8 : (k === 8) ? 6 : 0;
                  f[idx*9+k] = f_new[prev_idx*9+opposite_k];
                } else {
                  f[idx*9+k] = f_new[prev_idx*9+k];
                }
              }
            }
          }
        }

        // Inlet and Outlet
        for (let j = 0; j < simHeight; j++) {
          const idx_in = j * simWidth;
          if (isBoundary[idx_in]) continue;
          const rho_in = (f[idx_in*9+0] + f[idx_in*9+2] + f[idx_in*9+4] + 2*(f[idx_in*9+3] + f[idx_in*9+6] + f[idx_in*9+7])) / (1-inletVel);
          for (let k of [1, 5, 8]) { 
           const u_dot_c = inletVel * cx[k];
           const u_sq = inletVel*inletVel;
           const eq_k = rho_in * weights[k] * (1 + 3*u_dot_c + 4.5*u_dot_c*u_dot_c - 1.5*u_sq);
           f[idx_in*9+k] = eq_k;
          }
          const idx_out1 = j * simWidth + (simWidth - 1);
          const idx_out2 = j * simWidth + (simWidth - 2);
          if(!isBoundary[idx_out1]) {
            for(let k=0; k<9; k++) f[idx_out1*9+k] = f[idx_out2*9+k];
          }
        }
      }
      
      function visualizeVelocity() {
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const scaleX = canvas.width / simWidth;
        const scaleY = canvas.height / simHeight;

        for (let j = 0; j < simHeight; j++) {
          for (let i = 0; i < simWidth; i++) {
            const simIdx = j * simWidth + i;
            let r, g, b;
            if(isBoundary[simIdx]) {
              r=0; g=0; b=0; // Black for boundaries
            } else {
              const velocityMagnitude = Math.sqrt(ux[simIdx] * ux[simIdx] + uy[simIdx] * uy[simIdx]);
              const c = Math.min(velocityMagnitude / (parseFloat(inletVelocitySlider.max) * 1.5), 1.0);
              r = Math.round(255 * Math.max(0, 2 * c - 1));
              g = Math.round(255 * (1 - 2 * Math.abs(c - 0.5)));
              b = Math.round(255 * Math.max(0, 1 - 2 * c));
            }
            
            for (let y = Math.floor(j * scaleY); y < Math.floor((j + 1) * scaleY); y++) {
              for (let x = Math.floor(i * scaleX); x < Math.floor((i + 1) * scaleX); x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                imageData.data[pixelIndex] = r;
                imageData.data[pixelIndex + 1] = g;
                imageData.data[pixelIndex + 2] = b;
                imageData.data[pixelIndex + 3] = 255;
              }
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);

        if (showQuiversCheckbox.checked) {
          drawQuiverPlot();
        }
      }
    
      function visualizePressure() {
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const scaleX = canvas.width / simWidth;
        const scaleY = canvas.height / simHeight;
        
        // Get min/max density for normalization
        let minRho = Infinity, maxRho = -Infinity;
        for (let j = 0; j < simHeight; j++) {
          for (let i = 0; i < simWidth; i++) {
            const simIdx = j * simWidth + i;
            if (!isBoundary[simIdx]) {
              minRho = Math.min(minRho, rho[simIdx]);
              maxRho = Math.max(maxRho, rho[simIdx]);
            }
          }
        }
        
        for (let j = 0; j < simHeight; j++) {
          for (let i = 0; i < simWidth; i++) {
            const simIdx = j * simWidth + i;
            let r, g, b;
            if (isBoundary[simIdx]) {
              r = 0; g = 0; b = 0; // Black for boundaries
            } else {
              const normalizedPressure = (rho[simIdx] - minRho) / (maxRho - minRho);
              // A simple gradient from blue (low pressure) to red (high pressure)
              r = Math.round(normalizedPressure * 255);
              g = 0;
              b = Math.round((1 - normalizedPressure) * 255);
            }

            for (let y = Math.floor(j * scaleY); y < Math.floor((j + 1) * scaleY); y++) {
              for (let x = Math.floor(i * scaleX); x < Math.floor((i + 1) * scaleX); x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                imageData.data[pixelIndex] = r;
                imageData.data[pixelIndex + 1] = g;
                imageData.data[pixelIndex + 2] = b;
                imageData.data[pixelIndex + 3] = 255;
              }
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);

        if (showQuiversCheckbox.checked) {
          drawQuiverPlot();
        }
      }

      function drawQuiverPlot() {
        const density = parseInt(quiverDensitySlider.value);
        const scale = parseInt(quiverScaleSlider.value);
        const scaleX = canvas.width / simWidth;
        const scaleY = canvas.height / simHeight;
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;

        for (let j = 0; j < simHeight; j += density) {
          for (let i = 0; i < simWidth; i += density) {
            const simIdx = j * simWidth + i;
            if (isBoundary[simIdx]) continue;

            const vx = ux[simIdx];
            const vy = uy[simIdx];
            
            const startX = i * scaleX;
            const startY = j * scaleY;
            const endX = startX + vx * scale * 10;
            const endY = startY + vy * scale * 10;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            
            const headlen = 5;
            const angle = Math.atan2(endY - startY, endX - startX);
            ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
            
            ctx.stroke();
          }
        }
      }


      function mainLoop() {
        simulationStep();
        if (showPressureCheckbox.checked) {
          visualizePressure();
        } else {
          visualizeVelocity();
        }
        animationFrameId = requestAnimationFrame(mainLoop);
      }

      function setupEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);

        // Domain Listeners
        gridSizeSlider.addEventListener('input', (e) => {
          gridSizeValue.textContent = e.target.value;
        });

        // Fluid Listeners
        inletVelocitySlider.addEventListener('input', (e) => {
          velocityValueSpan.textContent = parseFloat(e.target.value).toFixed(2);
        });
        
        function updateVelocityBounds() {
          const min = parseFloat(minVelocityInput.value);
          const max = parseFloat(maxVelocityInput.value);
          if (min >= max) {
            minVelocityInput.value = max - 0.01;
          }
          inletVelocitySlider.min = minVelocityInput.value;
          inletVelocitySlider.max = maxVelocityInput.value;
          if (inletVelocitySlider.value < min) inletVelocitySlider.value = min;
          if (inletVelocitySlider.value > max) inletVelocitySlider.value = max;
          velocityValueSpan.textContent = parseFloat(inletVelocitySlider.value).toFixed(2);
        }
        // minVelocityInput.addEventListener('change', updateVelocityBounds);
        // maxVelocityInput.addEventListener('change', updateVelocityBounds);
        
        // Visualization listeners
        const vizControls = [showQuiversCheckbox, quiverDensitySlider, quiverScaleSlider, showPressureCheckbox];
        vizControls.forEach(control => {
          control.addEventListener('change', () => {
            if (!simRunning) {
              // If simulation is stopped, we still need to render the visual
              if (showPressureCheckbox.checked) {
                visualizePressure();
              } else {
                visualizeVelocity();
              }
            }
          });
        });
        
        // Control Listeners
        startSimBtn.addEventListener('click', () => {
          if (simRunning) return;
          
          simWidth = parseInt(gridSizeSlider.value);
          resizeCanvas(); // Recalculate dimensions
          initializeSimulationState(); // Recreate arrays with new size
          updateBoundariesFromCanvas(); // Re-apply drawing to the new grid

          simRunning = true;
          showQuiversCheckbox.disabled = false
          showPressureCheckbox.disabled = false
          simStatus.textContent = "Status: Running...";
          simStatus.classList.replace('text-gray-600', 'text-green-600');
          document.querySelectorAll('.tool-btn, #lineWidth, #grid-size').forEach(el => el.disabled = true);
          mainLoop();
        });

        stopSimBtn.addEventListener('click', () => {
          if (!simRunning) return;
          simRunning = false;
          showQuiversCheckbox.disabled = true
          showPressureCheckbox.disabled = true
          simStatus.textContent = "Status: Stopped";
          simStatus.classList.replace('text-green-600', 'text-gray-600');
          cancelAnimationFrame(animationFrameId);
          document.querySelectorAll('.tool-btn, #lineWidth, #grid-size').forEach(el => el.disabled = false);
        });

        clearBtn.addEventListener('click', () => {
          if (simRunning) stopSimBtn.click();
          simStatus.textContent = "Status: Ready";
          
          showQuiversCheckbox.checked = false;
          showPressureCheckbox.checked = false;
          
          simWidth = parseInt(gridSizeSlider.value);
          resizeCanvas();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          initializeSimulationState();
        });
        
        saveImageBtn.addEventListener('click', () => {
          const link = document.createElement('a');
          link.download = 'fluid-simulation.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        });

        toolBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelector('.tool-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentTool = btn.id.split('-')[1];
          });
        });
      }

      // --- Initial Execution ---
      setup();
    });
