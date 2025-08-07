document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM加载完成，开始初始化...');
  
  // 检查Three.js是否可用
  if (typeof THREE === 'undefined') {
    console.error('Three.js未加载');
    alert('Three.js库加载失败，请检查网络连接');
    return;
  }
  
  console.log('Three.js版本:', THREE.REVISION);
  
  // 初始化可视化器
  let currentVisualizer = null;
  let bvhVisualizer = null;
  let fbxVisualizer = null;
  
  // 创建BVH可视化器
  bvhVisualizer = new BVHVisualizer(
    document.getElementById("canvas-container")
  );
  
  // 让BVH可视化器可以被FBX可视化器访问
  window.bvhVisualizer = bvhVisualizer;
  
  // 创建FBX可视化器
  fbxVisualizer = new FBXVisualizer(
    document.getElementById("canvas-container")
  );
  
  // 让FBX可视化器可以被BVH可视化器访问
  window.fbxVisualizer = fbxVisualizer;
  
  // 默认使用BVH可视化器
  currentVisualizer = bvhVisualizer;
  
  // 让统一UI函数可以被可视化器访问
  window.updateUnifiedUI = updateUnifiedUI;
  window.updateUnifiedStatus = updateUnifiedStatus;
  
  // 创建统一UI
  createUnifiedUI();
  
  console.log('可视化器初始化完成');

  // BVH文件上传处理
  const bvhFileInput = document.getElementById("bvh-file");
  bvhFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      // 检查文件类型
      if (!file.name.toLowerCase().endsWith('.bvh')) {
        alert('请选择有效的BVH文件');
        return;
      }

      // 切换到BVH可视化器
      currentVisualizer = bvhVisualizer;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const bvhData = event.target.result;
          currentVisualizer.loadBVHData(bvhData);
          updateMotionInfo(currentVisualizer.getMotionInfo());
          updateFileInfo(file, 'BVH');
        } catch (error) {
          console.error('文件加载失败:', error);
          alert('文件加载失败: ' + error.message);
        }
      };
      reader.onerror = () => {
        alert('文件读取失败');
      };
      reader.readAsText(file);
    }
  });

  // FBX文件上传处理
  const fbxFileInput = document.getElementById("fbx-file");
  fbxFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      // 检查文件类型
      if (!file.name.toLowerCase().endsWith('.fbx')) {
        alert('请选择有效的FBX文件');
        return;
      }

      // 切换到FBX可视化器
      currentVisualizer = fbxVisualizer;

      try {
        currentVisualizer.loadFBXFile(file);
        updateMotionInfo(currentVisualizer.getMotionInfo());
        updateFileInfo(file, 'FBX');
      } catch (error) {
        console.error('文件加载失败:', error);
        alert('文件加载失败: ' + error.message);
      }
    }
  });

  // 播放/暂停按钮
  const playPauseButton = document.getElementById("play-pause");
  playPauseButton.addEventListener("click", () => {
    if (currentVisualizer.isPlaying()) {
      currentVisualizer.pause();
      playPauseButton.textContent = "播放";
    } else {
      currentVisualizer.play();
      playPauseButton.textContent = "暂停";
    }
  });

  // 添加停止按钮
  const stopButton = document.createElement("button");
  stopButton.textContent = "停止";
  stopButton.id = "stop-button";
  stopButton.addEventListener("click", () => {
    currentVisualizer.stop();
    playPauseButton.textContent = "播放";
  });
  
  // 插入停止按钮
  const controlsDiv = document.querySelector('.controls');
  controlsDiv.appendChild(stopButton);

  // 速度控制
  const speedSlider = document.getElementById("speed-slider");
  const speedValue = document.getElementById("speed-value");
  speedSlider.addEventListener("input", () => {
    const speed = parseFloat(speedSlider.value);
    speedValue.textContent = `${speed.toFixed(1)}x`;
    currentVisualizer.setPlaybackSpeed(speed);
  });

  // 添加循环控制
  const loopCheckbox = document.createElement("input");
  loopCheckbox.type = "checkbox";
  loopCheckbox.id = "loop-checkbox";
  loopCheckbox.checked = true;
  
  const loopLabel = document.createElement("label");
  loopLabel.htmlFor = "loop-checkbox";
  loopLabel.textContent = "循环播放";
  
  const loopContainer = document.createElement("div");
  loopContainer.className = "loop-control";
  loopContainer.appendChild(loopCheckbox);
  loopContainer.appendChild(loopLabel);
  
  controlsDiv.appendChild(loopContainer);
  
  loopCheckbox.addEventListener("change", () => {
    currentVisualizer.setLoop(loopCheckbox.checked);
  });

  // 添加键盘快捷键
  document.addEventListener("keydown", (e) => {
    switch(e.code) {
      case "Space":
        e.preventDefault();
        if (currentVisualizer.isPlaying()) {
          currentVisualizer.pause();
          playPauseButton.textContent = "播放";
        } else {
          currentVisualizer.play();
          playPauseButton.textContent = "暂停";
        }
        break;
      case "KeyS":
        if (e.ctrlKey) {
          e.preventDefault();
          currentVisualizer.stop();
          playPauseButton.textContent = "播放";
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        const currentTime = currentVisualizer.currentTime || 0;
        currentVisualizer.seekTo(Math.max(0, currentTime - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        const currentTime2 = currentVisualizer.currentTime || 0;
        const duration = currentVisualizer.duration || 0;
        currentVisualizer.seekTo(Math.min(duration, currentTime2 + 1));
        break;
    }
  });

  // 更新动作信息面板
  function updateMotionInfo(info) {
    const infoPanel = document.getElementById("motion-info");
    if (info) {
      infoPanel.innerHTML = `
        <p><strong>帧数:</strong> ${info.frames}</p>
        <p><strong>帧率:</strong> ${info.frameTime.toFixed(2)} FPS</p>
        <p><strong>总时长:</strong> ${info.duration.toFixed(2)} 秒</p>
        <p><strong>关节数:</strong> ${info.joints}</p>
      `;
    } else {
      infoPanel.innerHTML = "<p>未加载BVH数据</p>";
    }
  }

  // 更新文件信息
  function updateFileInfo(file, type) {
    const fileInfoDiv = document.createElement("div");
    fileInfoDiv.className = "file-info";
    fileInfoDiv.innerHTML = `
      <h3>文件信息</h3>
      <p><strong>文件类型:</strong> ${type}</p>
      <p><strong>文件名:</strong> ${file.name}</p>
      <p><strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
      <p><strong>修改时间:</strong> ${new Date(file.lastModified).toLocaleString()}</p>
    `;
    
    // 移除之前的文件信息
    const oldFileInfo = document.querySelector('.file-info');
    if (oldFileInfo) {
      oldFileInfo.remove();
    }
    
    // 插入新的文件信息
    const sidebar = document.querySelector('.sidebar');
    const infoPanel = document.getElementById('info-panel');
    sidebar.insertBefore(fileInfoDiv, infoPanel);
  }

  // 创建统一的UI元素
  function createUnifiedUI() {
    // 移除现有的时间轴和状态显示
    const existingTimelines = document.querySelectorAll('.timeline-container');
    existingTimelines.forEach(el => el.remove());
    
    const existingStatus = document.querySelectorAll('.status-display');
    existingStatus.forEach(el => el.remove());

    // 创建统一的时间轴
    const timelineContainer = document.createElement("div");
    timelineContainer.className = "timeline-container";
    timelineContainer.innerHTML = `
      <div class="timeline-controls">
        <input type="range" id="unified-timeline-slider" min="0" max="100" value="0" step="0.1">
        <span id="unified-time-display">00:00 / 00:00</span>
      </div>
    `;

    // 创建统一的状态显示
    const statusDiv = document.createElement("div");
    statusDiv.className = "status-display";
    statusDiv.innerHTML = '<div id="unified-status-text">准备就绪</div>';

    // 插入到侧边栏
    const sidebar = document.querySelector(".sidebar");
    const controlsDiv = sidebar.querySelector(".controls");
    sidebar.insertBefore(timelineContainer, controlsDiv.nextSibling);
    sidebar.appendChild(statusDiv);

    // 绑定时间轴事件
    const timelineSlider = document.getElementById("unified-timeline-slider");
    timelineSlider.addEventListener("input", (e) => {
      const progress = parseFloat(e.target.value) / 100;
      if (currentVisualizer) {
        currentVisualizer.seekTo(progress * currentVisualizer.duration);
      }
    });

    // 存储UI元素引用
    window.unifiedTimelineSlider = timelineSlider;
    window.unifiedTimeDisplay = document.getElementById("unified-time-display");
    window.unifiedStatusText = document.getElementById("unified-status-text");
  }

  // UI切换函数
  function updateUnifiedUI() {
    if (!currentVisualizer) return;
    
    // 更新时间轴
    if (window.unifiedTimelineSlider && currentVisualizer.duration > 0) {
      const progress = (currentVisualizer.currentTime / currentVisualizer.duration) * 100;
      window.unifiedTimelineSlider.value = progress;
      
      const currentTimeStr = currentVisualizer.formatTime(currentVisualizer.currentTime);
      const totalTimeStr = currentVisualizer.formatTime(currentVisualizer.duration);
      window.unifiedTimeDisplay.textContent = `${currentTimeStr} / ${totalTimeStr}`;
    }
  }

  function updateUnifiedStatus(message) {
    if (window.unifiedStatusText) {
      window.unifiedStatusText.textContent = message;
    }
  }

  // 初始化信息面板
  updateMotionInfo(null);

  // 响应窗口大小变化
  window.addEventListener("resize", () => {
    currentVisualizer.resize();
  });

  // 添加拖拽上传功能
  const canvasContainer = document.getElementById("canvas-container");
  
  canvasContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    canvasContainer.style.border = "2px dashed #3498db";
  });
  
  canvasContainer.addEventListener("dragleave", (e) => {
    e.preventDefault();
    canvasContainer.style.border = "none";
  });
  
  canvasContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    canvasContainer.style.border = "none";
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.bvh')) {
        bvhFileInput.files = e.dataTransfer.files;
        bvhFileInput.dispatchEvent(new Event('change'));
      } else if (fileName.endsWith('.fbx')) {
        fbxFileInput.files = e.dataTransfer.files;
        fbxFileInput.dispatchEvent(new Event('change'));
      } else {
        alert('请拖拽有效的BVH或FBX文件');
      }
    }
  });
});
