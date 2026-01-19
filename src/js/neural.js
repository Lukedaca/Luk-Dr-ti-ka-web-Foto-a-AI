/**
 * Neural Network Visualization module
 * Lazy loaded after 2s or on scroll
 */

const isLowPowerDevice = () => {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const connection = navigator.connection;
  const saveData = connection?.saveData;
  const effectiveType = connection?.effectiveType;
  return Boolean(saveData || memory <= 4 || cores <= 4 || effectiveType?.includes('2g'));
};

class NeuralNetworkVisualization {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.neurons = [];
    this.connections = [];
    this.mouse = { x: 0, y: 0 };
    this.pointer = { x: 0, y: 0 };
    this.pointerDirty = false;
    this.activityLevel = 0;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / 24;
    this.lowPower = isLowPowerDevice();
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isPaused = false;
    this.width = 0;
    this.height = 0;

    if (this.lowPower) this.frameInterval = 1000 / 12;
    
    this.resize();
    this.animate();

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.resize(), 150);
    });
    
    document.addEventListener('mousemove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointerDirty = true;
    }, { passive: true });
    
    document.addEventListener('visibilitychange', () => {
      this.isPaused = document.hidden;
      if (!this.isPaused) {
        this.lastFrameTime = 0;
        this.animate();
      }
    });
    
    document.addEventListener('click', () => {
      this.activityLevel = Math.min(this.activityLevel + 0.5, 1);
    });
  }
  
  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 1.25);
    this.canvas.width = Math.floor(this.width * scale);
    this.canvas.height = Math.floor(this.height * scale);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.neurons = [];
    this.connections = [];
    this.init();
  }

  init() {
    const layers = this.lowPower ? [4, 6, 4] : [5, 8, 6, 5];
    const spacing = this.width / (layers.length + 1);
    
    layers.forEach((count, layerIndex) => {
      const layerHeight = this.height / (count + 1);
      for (let i = 0; i < count; i++) {
        this.neurons.push({
          x: spacing * (layerIndex + 1),
          y: layerHeight * (i + 1),
          layer: layerIndex,
          index: i,
          activation: Math.random(),
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    });
    
    for (let i = 0; i < this.neurons.length; i++) {
      const neuron = this.neurons[i];
      for (let j = 0; j < this.neurons.length; j++) {
        const target = this.neurons[j];
        if (target.layer === neuron.layer + 1) {
          this.connections.push({ from: neuron, to: target, weight: Math.random() * 2 - 1 });
        }
      }
    }
  }
  
  animate(timestamp = 0) {
    if (this.reduceMotion || this.isPaused) return;

    if (this.pointerDirty) {
      this.mouse.x = this.pointer.x;
      this.mouse.y = this.pointer.y;
      this.pointerDirty = false;
    }

    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    const delta = timestamp - this.lastFrameTime;
    if (delta < this.frameInterval) {
      requestAnimationFrame((next) => this.animate(next));
      return;
    }

    this.lastFrameTime = timestamp;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.activityLevel *= 0.95;
    
    this.neurons.forEach(neuron => {
      neuron.pulsePhase += 0.02;
      const dx = neuron.x - this.mouse.x;
      const dy = neuron.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      neuron.activation = dist < 150 
        ? Math.min(1, neuron.activation + 0.1) 
        : neuron.activation * 0.98;
      neuron.activation += this.activityLevel * 0.1;
      neuron.activation = Math.max(0.1, Math.min(1, neuron.activation));
    });
    
    this.connections.forEach(conn => {
      const alpha = (conn.from.activation + conn.to.activation) / 2;
      this.ctx.beginPath();
      this.ctx.moveTo(conn.from.x, conn.from.y);
      this.ctx.lineTo(conn.to.x, conn.to.y);
      const gradient = this.ctx.createLinearGradient(conn.from.x, conn.from.y, conn.to.x, conn.to.y);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${alpha * 0.45})`);
      gradient.addColorStop(1, `rgba(168, 85, 247, ${alpha * 0.45})`);
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = Math.abs(conn.weight) * 2;
      this.ctx.stroke();
    });
    
    this.neurons.forEach(neuron => {
      const pulse = Math.sin(neuron.pulsePhase) * 0.3 + 0.7;
      const radius = 4 + neuron.activation * 4 * pulse;
      const gradient = this.ctx.createRadialGradient(neuron.x, neuron.y, 0, neuron.x, neuron.y, radius * 3);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${neuron.activation * 0.8})`);
      gradient.addColorStop(0.5, `rgba(168, 85, 247, ${neuron.activation * 0.4})`);
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(neuron.x, neuron.y, radius * 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = `rgba(255, 255, 255, ${neuron.activation})`;
      this.ctx.beginPath();
      this.ctx.arc(neuron.x, neuron.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    requestAnimationFrame((next) => this.animate(next));
  }
}

// Auto-init
const neuralCanvas = document.getElementById('neuralCanvas');
if (neuralCanvas) {
  new NeuralNetworkVisualization(neuralCanvas);
}
