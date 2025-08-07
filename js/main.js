document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM加载完成，开始初始化...");

  // 检查Three.js是否可用
  if (typeof THREE === "undefined") {
    console.error("Three.js未加载");
    alert("Three.js库加载失败，请检查网络连接");
    return;
  }

  console.log("Three.js版本:", THREE.REVISION);

  // 检查可视化器类是否可用
  if (typeof BVHVisualizer === "undefined") {
    console.error("BVHVisualizer未加载");
    alert("BVHVisualizer加载失败");
    return;
  }

  if (typeof FBXVisualizer === "undefined") {
    console.error("FBXVisualizer未加载");
    alert("FBXVisualizer加载失败");
    return;
  }

  console.log("所有必要的类都已加载");

  // 初始化可视化器
  let currentVisualizer = null;
  let bvhVisualizer = null;
  let fbxVisualizer = null;

  // 创建BVH可视化器
  bvhVisualizer = new BVHVisualizer(
    document.getElementById("canvas-container")
  );
  console.log("BVH可视化器创建成功:", bvhVisualizer); // 调试信息

  // 让BVH可视化器可以被FBX可视化器访问
  window.bvhVisualizer = bvhVisualizer;

  // 创建FBX可视化器
  fbxVisualizer = new FBXVisualizer(
    document.getElementById("canvas-container")
  );
  console.log("FBX可视化器创建成功:", fbxVisualizer); // 调试信息

  // 让FBX可视化器可以被BVH可视化器访问
  window.fbxVisualizer = fbxVisualizer;

  // 默认使用BVH可视化器
  currentVisualizer = bvhVisualizer;
  console.log("当前可视化器:", currentVisualizer); // 调试信息

  // 让统一UI函数可以被可视化器访问
  window.updateUnifiedUI = updateUnifiedUI;
  window.updateUnifiedStatus = updateUnifiedStatus;
  window.updateMotionInfo = updateMotionInfo;

  // 创建统一UI
  createUnifiedUI();

  console.log("可视化器初始化完成");

  // 统一文件上传处理
  const fileInput = document.getElementById("file-input");
  console.log("文件输入框元素:", fileInput); // 调试信息
  const dropZone = document.getElementById("drop-zone");
  const filePickerBtn = document.getElementById("file-picker-btn");

  fileInput.addEventListener("change", (e) => {
    console.log("文件选择事件触发"); // 调试信息
    const file = e.target.files[0];
    console.log("选择的文件:", file); // 调试信息

    if (file) {
      const fileName = file.name.toLowerCase();
      console.log("文件名:", fileName); // 调试信息

      // 根据文件后缀自动识别文件类型
      if (fileName.endsWith(".bvh")) {
        console.log("检测到BVH文件，开始处理..."); // 调试信息
        // 处理BVH文件
        currentVisualizer = bvhVisualizer;

        const reader = new FileReader();
        reader.onload = (event) => {
          console.log("BVH文件读取完成"); // 调试信息
          try {
            const bvhData = event.target.result;
            currentVisualizer.loadBVHData(bvhData);
            updateMotionInfo(currentVisualizer.getMotionInfo());
            updateFileInfo(file, "BVH");
            updateUnifiedStatus("BVH文件加载成功");
          } catch (error) {
            console.error("BVH文件加载失败:", error);
            alert("BVH文件加载失败: " + error.message);
            updateUnifiedStatus("BVH文件加载失败");
          }
        };
        reader.onerror = () => {
          console.error("BVH文件读取失败"); // 调试信息
          alert("BVH文件读取失败");
          updateUnifiedStatus("BVH文件读取失败");
        };
        reader.readAsText(file);
      } else if (fileName.endsWith(".fbx")) {
        console.log("检测到FBX文件，开始处理..."); // 调试信息
        // 处理FBX文件
        currentVisualizer = fbxVisualizer;

        try {
          currentVisualizer.loadFBXFile(file);
          updateMotionInfo(currentVisualizer.getMotionInfo());
          updateFileInfo(file, "FBX");
          updateUnifiedStatus("FBX文件加载成功");
        } catch (error) {
          console.error("FBX文件加载失败:", error);
          alert("FBX文件加载失败: " + error.message);
          updateUnifiedStatus("FBX文件加载失败");
        }
      } else {
        console.log("不支持的文件格式:", fileName); // 调试信息
        alert("请选择有效的BVH或FBX文件");
        updateUnifiedStatus("不支持的文件格式");
      }
    } else {
      console.log("没有选择文件"); // 调试信息
    }
  });

  // 美化按钮触发文件选择
  if (filePickerBtn) {
    filePickerBtn.addEventListener("click", () => fileInput.click());
  }

  // 拖拽上传（侧栏拖拽框）
  if (dropZone) {
    const setDragState = (on) => {
      dropZone.classList.toggle("dragover", !!on);
    };

    ["dragenter", "dragover"].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState(true);
      });
    });

    ["dragleave", "dragend"].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState(false);
      });
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        fileInput.files = files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });

    // 点击或键盘回车触发文件选择
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

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

  // 将播放与停止排成一行
  const controlsDiv = document.querySelector(".controls");
  const firstSlider = controlsDiv.querySelector(".slider-container");
  const btnRow = document.createElement("div");
  btnRow.className = "controls-row";
  btnRow.appendChild(playPauseButton);
  btnRow.appendChild(stopButton);
  if (firstSlider) {
    controlsDiv.insertBefore(btnRow, firstSlider);
  } else {
    controlsDiv.appendChild(btnRow);
  }

  // FBX蒙皮开关
  const skinToggle = document.createElement("button");
  skinToggle.id = "skin-toggle";
  skinToggle.textContent = "隐藏蒙皮";
  skinToggle.addEventListener("click", () => {
    if (!window.fbxVisualizer) return;
    const newVisible = !window.fbxVisualizer.skinVisible;
    window.fbxVisualizer.setSkinVisible(newVisible);
    skinToggle.textContent = newVisible ? "隐藏蒙皮" : "显示蒙皮";
    updateUnifiedStatus &&
      updateUnifiedStatus(newVisible ? "蒙皮可见" : "蒙皮已隐藏");
  });
  controlsDiv.appendChild(skinToggle);

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

  // 主题切换
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    const THEME_KEY = "theme-preference";
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const saved = localStorage.getItem(THEME_KEY);
    const initial = saved || (prefersDark ? "theme-dark" : "theme-light");

    function applyTheme(theme) {
      const root = document.documentElement;
      root.classList.remove("theme-dark", "theme-light");
      root.classList.add(theme);
      localStorage.setItem(THEME_KEY, theme);
      themeToggle.textContent = theme === "theme-dark" ? "☀️" : "🌙";
      themeToggle.setAttribute(
        "aria-label",
        theme === "theme-dark" ? "切换到浅色" : "切换到深色"
      );
      if (theme === "theme-dark") {
        updateUnifiedStatus && updateUnifiedStatus("已切换为深色模式");
      } else {
        updateUnifiedStatus && updateUnifiedStatus("已切换为浅色模式");
      }
    }

    applyTheme(initial);

    themeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.classList.contains("theme-dark");
      applyTheme(isDark ? "theme-light" : "theme-dark");
    });
  }

  // 添加键盘快捷键
  document.addEventListener("keydown", (e) => {
    switch (e.code) {
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
    if (info && currentVisualizer) {
      const frames = info.frames ?? "-";
      const fps = info.frameTime ? (1 / info.frameTime).toFixed(2) : "-";
      const duration = info.duration ? info.duration.toFixed(2) : "-";
      const joints = info.joints ?? "-";

      const bones = currentVisualizer.getBoneEntries
        ? currentVisualizer.getBoneEntries()
        : currentVisualizer.getBoneNames
        ? currentVisualizer.getBoneNames().map((n) => ({ label: n, uuid: n }))
        : [];
      const endSites = currentVisualizer.getEndSiteEntries
        ? currentVisualizer.getEndSiteEntries()
        : currentVisualizer.getEndSiteNames
        ? currentVisualizer
            .getEndSiteNames()
            .map((n) => ({ label: n, uuid: n }))
        : [];
      const objects = currentVisualizer.getObjectNames
        ? currentVisualizer.getObjectNames()
        : [];

      // 构建有序合并列表（骨骼 + End Site）
      const ordered = currentVisualizer.getOrderedBoneEntries
        ? currentVisualizer.getOrderedBoneEntries()
        : [
            ...bones.map((e, idx) => ({ index: idx + 1, ...e })),
            ...endSites.map((e, idx) => ({
              index: bones.length + idx + 1,
              ...e,
            })),
          ];
      const orderedListItems = ordered
        .map(
          (e) =>
            `<li data-kind="bone" data-uuid="${e.uuid}" data-name="${e.label}"><span class="li-label">${e.label}</span></li>`
        )
        .join("");
      const objectsList = objects
        .map((n) => `<li data-kind="object" data-name="${n}">${n}</li>`)
        .join("");
      // 已合并到 orderedListItems

      infoPanel.innerHTML = `
        <p><strong>帧数:</strong> ${frames}</p>
        <p><strong>帧率:</strong> ${fps} FPS</p>
        <p><strong>总时长:</strong> ${duration} 秒</p>
        <p><strong>关节数:</strong> ${joints}</p>
        <details class="collapsible">
          <summary>骨骼列表 (${ordered.length})</summary>
          <ol class="info-list info-list-ordered">${
            orderedListItems || "<li>无</li>"
          }</ol>
        </details>
        <details class="collapsible">
          <summary>物体列表 (${objects.length})</summary>
          <ul class="info-list">${objectsList || "<li>无</li>"}</ul>
        </details>
      `;

      // 绑定高亮交互
      const infoLists = infoPanel.querySelectorAll(".info-list");
      infoLists.forEach((ul) => {
        ul.addEventListener("mouseover", (e) => {
          const li = e.target.closest("li");
          if (!li) return;
          const kind = li.getAttribute("data-kind");
          const uuid = li.getAttribute("data-uuid");
          const name = li.getAttribute("data-name");
          if (
            kind === "bone" &&
            window.bvhVisualizer &&
            (window.bvhVisualizer.highlightBoneByUUID ||
              window.bvhVisualizer.highlightBoneByName)
          ) {
            if (window.bvhVisualizer.highlightBoneByUUID && uuid) {
              window.bvhVisualizer.highlightBoneByUUID(uuid);
            } else {
              window.bvhVisualizer.highlightBoneByName(name);
            }
          } else if (
            kind === "object" &&
            window.fbxVisualizer &&
            window.fbxVisualizer.highlightObjectByName
          ) {
            window.fbxVisualizer.highlightObjectByName(name);
          }
        });
        ul.addEventListener("mouseout", () => {
          if (window.bvhVisualizer && window.bvhVisualizer.clearHighlights) {
            window.bvhVisualizer.clearHighlights();
          }
          if (window.fbxVisualizer && window.fbxVisualizer.clearHighlights) {
            window.fbxVisualizer.clearHighlights();
          }
        });
        ul.addEventListener("click", (e) => {
          const li = e.target.closest("li");
          if (!li) return;
          const kind = li.getAttribute("data-kind");
          const uuid = li.getAttribute("data-uuid");
          const name = li.getAttribute("data-name");
          if (
            kind === "bone" &&
            window.bvhVisualizer &&
            (window.bvhVisualizer.highlightBoneByUUID ||
              window.bvhVisualizer.highlightBoneByName)
          ) {
            if (window.bvhVisualizer.highlightBoneByUUID && uuid) {
              window.bvhVisualizer.highlightBoneByUUID(uuid);
            } else {
              window.bvhVisualizer.highlightBoneByName(name);
            }
          } else if (
            kind === "object" &&
            window.fbxVisualizer &&
            window.fbxVisualizer.highlightObjectByName
          ) {
            window.fbxVisualizer.highlightObjectByName(name);
          }
        });
      });
    } else {
      infoPanel.innerHTML = "<p>未加载数据</p>";
    }
  }

  // 更新文件信息
  function updateFileInfo(file, type) {
    const fileInfoPanel = document.getElementById("file-info");
    if (!fileInfoPanel) return;
    fileInfoPanel.innerHTML = `
      <p><strong>文件类型:</strong> ${type}</p>
      <p><strong>文件名:</strong> <span class="file-name">${
        file.name
      }</span></p>
      <p><strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
      <p><strong>修改时间:</strong> ${new Date(
        file.lastModified
      ).toLocaleString()}</p>
    `;
  }

  // 创建统一的UI元素
  function createUnifiedUI() {
    // 移除现有的时间轴和状态显示
    const existingTimelines = document.querySelectorAll(".timeline-container");
    existingTimelines.forEach((el) => el.remove());

    const existingStatus = document.querySelectorAll(".status-display");
    existingStatus.forEach((el) => el.remove());

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
      const progress =
        (currentVisualizer.currentTime / currentVisualizer.duration) * 100;
      window.unifiedTimelineSlider.value = progress;

      const currentTimeStr = currentVisualizer.formatTime(
        currentVisualizer.currentTime
      );
      const totalTimeStr = currentVisualizer.formatTime(
        currentVisualizer.duration
      );

      // 计算帧信息
      let frameSuffix = "";
      const info =
        currentVisualizer.getMotionInfo && currentVisualizer.getMotionInfo();
      if (info && info.frames && info.frameTime) {
        const totalFrames = info.frames;
        const currentFrame = Math.min(
          totalFrames,
          Math.max(
            1,
            Math.floor(currentVisualizer.currentTime / info.frameTime) + 1
          )
        );
        frameSuffix = ` · 帧 ${currentFrame}/${totalFrames}`;
      }

      window.unifiedTimeDisplay.textContent = `${currentTimeStr} / ${totalTimeStr}${frameSuffix}`;
    }
  }

  function updateUnifiedStatus(message) {
    if (window.unifiedStatusText) {
      window.unifiedStatusText.textContent = message;
    }
  }

  // 初始化信息面板
  updateMotionInfo(null);
  const fileInfoPanel = document.getElementById("file-info");
  if (fileInfoPanel) fileInfoPanel.innerHTML = "<p>未加载数据</p>";

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

      if (fileName.endsWith(".bvh")) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      } else if (fileName.endsWith(".fbx")) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      } else {
        alert("请拖拽有效的BVH或FBX文件");
        updateUnifiedStatus("不支持的文件格式");
      }
    }
  });
});
