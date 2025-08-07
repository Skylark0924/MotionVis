/**
 * 轨道控制器
 * 用于控制Three.js相机的旋转、缩放和平移
 */

class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    
    this.target = new THREE.Vector3();
    this.enableDamping = true;
    this.dampingFactor = 0.15;
    
    this.enableZoom = true;
    this.zoomSpeed = 1.0;
    
    this.enableRotate = true;
    this.rotateSpeed = 0.8;
    
    this.enablePan = true;
    this.panSpeed = 1.0;
    
    this.minDistance = 0;
    this.maxDistance = Infinity;
    
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    
    this.minAzimuthAngle = -Infinity;
    this.maxAzimuthAngle = Infinity;
    
    this.enableKeys = true;
    this.keyPanSpeed = 7.0;
    
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0;
    
    this.enableDamping = true;
    this.dampingFactor = 0.15;
    
    this.screenSpacePanning = false;
    
    this.enabled = true;
    this.state = STATE.NONE;
    
    this.scale = 1;
    this.zoomChanged = false;
    
    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();
    
    this.panStart = new THREE.Vector2();
    this.panEnd = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();
    this.panOffset = new THREE.Vector3();
    
    this.zoomStart = new THREE.Vector2();
    this.zoomEnd = new THREE.Vector2();
    this.zoomDelta = new THREE.Vector2();
    
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    
    this.scale = 1;
    this.zoomChanged = false;
    
    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();
    
    this.panStart = new THREE.Vector2();
    this.panEnd = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();
    this.panOffset = new THREE.Vector3();
    
    this.zoomStart = new THREE.Vector2();
    this.zoomEnd = new THREE.Vector2();
    this.zoomDelta = new THREE.Vector2();
    
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    
    this.update();
    
    this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this), false);
    this.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this), false);
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), false);
    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), false);
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), false);
    
    this.domElement.ownerDocument.addEventListener('pointermove', this.onPointerMove.bind(this), false);
    this.domElement.ownerDocument.addEventListener('pointerup', this.onPointerUp.bind(this), false);
  }
  
  update() {
    const offset = new THREE.Vector3();
    const quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
    const quatInverse = quat.clone().invert();
    
    offset.copy(this.camera.position).sub(this.target);
    offset.applyQuaternion(quat);
    
    this.spherical.setFromVector3(offset);
    
    if (this.autoRotate && this.state === STATE.NONE) {
      this.rotateLeft(this.getAutoRotationAngle());
    }
    
    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;
    
    this.spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, this.spherical.theta));
    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
    
    this.spherical.makeSafe();
    
    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
    
    this.target.addScaledVector(this.panOffset, 1);
    
    offset.setFromSpherical(this.spherical);
    offset.applyQuaternion(quatInverse);
    
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    
    if (this.enableDamping === true) {
      this.sphericalDelta.theta *= (1 - this.dampingFactor);
      this.sphericalDelta.phi *= (1 - this.dampingFactor);
      this.panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this.sphericalDelta.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
    }
    
    this.scale = 1;
    
    if (this.zoomChanged) {
      this.zoomChanged = false;
    }
  }
  
  onContextMenu(event) {
    if (this.enabled === false) return;
    event.preventDefault();
  }
  
  onPointerDown(event) {
    if (this.enabled === false) return;
    
    switch (event.pointerType) {
      case 'mouse':
      case 'pen':
        this.onMouseDown(event);
        break;
      default:
        this.onTouchStart(event);
        break;
    }
  }
  
  onPointerMove(event) {
    if (this.enabled === false) return;
    
    switch (event.pointerType) {
      case 'mouse':
      case 'pen':
        this.onMouseMove(event);
        break;
      default:
        this.onTouchMove(event);
        break;
    }
  }
  
  onPointerUp(event) {
    if (this.enabled === false) return;
    
    switch (event.pointerType) {
      case 'mouse':
      case 'pen':
        this.onMouseUp(event);
        break;
      default:
        this.onTouchEnd(event);
        break;
    }
  }
  
  onMouseDown(event) {
    // 检查事件是否发生在canvas元素内
    if (event.target !== this.domElement && !this.domElement.contains(event.target)) {
      return;
    }
    
    event.preventDefault();
    
    if (event.button === 0) {
      this.rotateStart.set(event.clientX, event.clientY);
      this.state = STATE.ROTATE;
    } else if (event.button === 1) {
      this.panStart.set(event.clientX, event.clientY);
      this.state = STATE.PAN;
    } else if (event.button === 2) {
      this.zoomStart.set(event.clientX, event.clientY);
      this.state = STATE.DOLLY;
    }
  }
  
  onMouseMove(event) {
    // 检查是否正在拖拽
    if (this.state === STATE.NONE) {
      return;
    }
    
    event.preventDefault();
    
    if (this.state === STATE.ROTATE) {
      this.rotateEnd.set(event.clientX, event.clientY);
      this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed * 0.3); // 进一步降低旋转灵敏度
      this.rotateLeft(2 * Math.PI * this.rotateDelta.x / this.domElement.clientHeight);
      this.rotateUp(2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight);
      this.rotateStart.copy(this.rotateEnd);
    } else if (this.state === STATE.PAN) {
      this.panEnd.set(event.clientX, event.clientY);
      this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
      this.pan(this.panDelta.x, this.panDelta.y);
      this.panStart.copy(this.panEnd);
    } else if (this.state === STATE.DOLLY) {
      this.zoomEnd.set(event.clientX, event.clientY);
      this.zoomDelta.subVectors(this.zoomEnd, this.zoomStart);
      if (this.zoomDelta.y > 0) {
        this.zoomOut(this.getZoomScale());
      } else {
        this.zoomIn(this.getZoomScale());
      }
      this.zoomStart.copy(this.zoomEnd);
    }
  }
  
  onMouseUp(event) {
    // 重置状态
    this.state = STATE.NONE;
    this.rotateStart.set(0, 0);
    this.panStart.set(0, 0);
    this.zoomStart.set(0, 0);
  }
  
  onMouseWheel(event) {
    // 检查事件是否发生在canvas元素内
    if (event.target !== this.domElement && !this.domElement.contains(event.target)) {
      return;
    }
    
    event.preventDefault();
    
    if (event.deltaY < 0) {
      this.zoomIn(this.getZoomScale());
    } else {
      this.zoomOut(this.getZoomScale());
    }
  }
  
  onTouchStart(event) {
    // 处理触摸开始事件
  }
  
  onTouchMove(event) {
    // 处理触摸移动事件
  }
  
  onTouchEnd(event) {
    // 处理触摸结束事件
  }
  
  rotateLeft(angle) {
    this.sphericalDelta.theta -= angle;
  }
  
  rotateUp(angle) {
    this.sphericalDelta.phi -= angle;
  }
  
  pan(deltaX, deltaY) {
    const element = this.domElement;
    
    if (this.camera.isPerspectiveCamera) {
      const position = this.camera.position;
      const offset = new THREE.Vector3();
      const quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
      const quatInverse = quat.clone().invert();
      
      offset.copy(position).sub(this.target);
      offset.applyQuaternion(quatInverse);
      
      const distance = offset.length();
      
      const scale = distance * Math.tan((this.camera.fov / 2) * Math.PI / 180) * 2;
      
      const panOffset = new THREE.Vector3(
        -deltaX * scale / element.clientHeight,
        deltaY * scale / element.clientHeight,
        0
      );
      
      offset.add(panOffset);
      offset.applyQuaternion(quat);
      
      position.copy(this.target).add(offset);
      this.target.add(panOffset);
    }
  }
  
  zoomIn(zoomScale) {
    this.scale /= zoomScale;
  }
  
  zoomOut(zoomScale) {
    this.scale *= zoomScale;
  }
  
  getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }
  
  getAutoRotationAngle() {
    return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }
}

const STATE = {
  NONE: -1,
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2
};
