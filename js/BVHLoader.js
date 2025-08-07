/**
 * BVH文件加载器
 * 用于解析BVH格式的动作捕捉数据
 */

class BVHLoader {
  constructor(manager) {
    this.manager =
      manager !== undefined ? manager : THREE.DefaultLoadingManager;
    this.animateBonePositions = true;
    this.animateBoneRotations = true;
  }

  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new THREE.FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setRequestHeader(scope.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    loader.load(
      url,
      function (text) {
        try {
          onLoad(scope.parse(text));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      },
      onProgress,
      onError
    );
  }

  parse(text) {
    const lines = text.split(/[\r\n]+/g);
    const bones = this.readBvh(lines);
    const threeBones = [];
    this.toTHREEBone(bones[0], threeBones);
    const threeClip = this.toTHREEAnimation(bones, threeBones);

    return {
      skeleton: new THREE.Skeleton(threeBones),
      clip: threeClip,
    };
  }

  readBvh(lines) {
    if (this.nextLine(lines) !== "HIERARCHY") {
      console.error("BVHLoader: HIERARCHY expected.");
    }

    const list = [];
    const root = this.readNode(lines, this.nextLine(lines), list);

    if (this.nextLine(lines) !== "MOTION") {
      console.error("BVHLoader: MOTION expected.");
    }

    let tokens = this.nextLine(lines).split(/[\s]+/);
    const numFrames = parseInt(tokens[1]);

    if (isNaN(numFrames)) {
      console.error("BVHLoader: Failed to read number of frames.");
    }

    tokens = this.nextLine(lines).split(/[\s]+/);
    const frameTime = parseFloat(tokens[2]);

    if (isNaN(frameTime)) {
      console.error("BVHLoader: Failed to read frame time.");
    }

    for (let i = 0; i < numFrames; i++) {
      tokens = this.nextLine(lines).split(/[\s]+/);
      this.readFrameData(tokens, i * frameTime, root);
    }

    return list;
  }

  readFrameData(data, frameTime, bone) {
    if (bone.type === "ENDSITE") return;

    const keyframe = {
      time: frameTime,
      position: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
    };

    bone.frames.push(keyframe);

    const quat = new THREE.Quaternion();
    const vx = new THREE.Vector3(1, 0, 0);
    const vy = new THREE.Vector3(0, 1, 0);
    const vz = new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < bone.channels.length; i++) {
      switch (bone.channels[i]) {
        case "Xposition":
          keyframe.position.x = parseFloat(data.shift().trim());
          break;
        case "Yposition":
          keyframe.position.y = parseFloat(data.shift().trim());
          break;
        case "Zposition":
          keyframe.position.z = parseFloat(data.shift().trim());
          break;
        case "Xrotation":
          quat.setFromAxisAngle(
            vx,
            (parseFloat(data.shift().trim()) * Math.PI) / 180
          );
          keyframe.rotation.multiply(quat);
          break;
        case "Yrotation":
          quat.setFromAxisAngle(
            vy,
            (parseFloat(data.shift().trim()) * Math.PI) / 180
          );
          keyframe.rotation.multiply(quat);
          break;
        case "Zrotation":
          quat.setFromAxisAngle(
            vz,
            (parseFloat(data.shift().trim()) * Math.PI) / 180
          );
          keyframe.rotation.multiply(quat);
          break;
        default:
          console.warn("BVHLoader: Invalid channel type.");
      }
    }

    for (let i = 0; i < bone.children.length; i++) {
      this.readFrameData(data, frameTime, bone.children[i]);
    }
  }

  readNode(lines, firstline, list) {
    const node = { name: "", type: "", frames: [] };
    list.push(node);

    let tokens = firstline.split(/[\s]+/);

    if (
      tokens[0].toUpperCase() === "END" &&
      tokens[1].toUpperCase() === "SITE"
    ) {
      node.type = "ENDSITE";
      node.name = "ENDSITE";
    } else {
      node.name = tokens[1];
      node.type = tokens[0].toUpperCase();
    }

    if (this.nextLine(lines) !== "{") {
      console.error("BVHLoader: Expected opening { after type & name");
    }

    tokens = this.nextLine(lines).split(/[\s]+/);

    if (tokens[0] !== "OFFSET") {
      console.error("BVHLoader: Expected OFFSET but got: " + tokens[0]);
    }

    if (tokens.length !== 4) {
      console.error("BVHLoader: Invalid number of values for OFFSET.");
    }

    const offset = new THREE.Vector3(
      parseFloat(tokens[1]),
      parseFloat(tokens[2]),
      parseFloat(tokens[3])
    );

    if (isNaN(offset.x) || isNaN(offset.y) || isNaN(offset.z)) {
      console.error("BVHLoader: Invalid values of OFFSET.");
    }

    node.offset = offset;

    if (node.type !== "ENDSITE") {
      tokens = this.nextLine(lines).split(/[\s]+/);

      if (tokens[0] !== "CHANNELS") {
        console.error("BVHLoader: Expected CHANNELS definition.");
      }

      const numChannels = parseInt(tokens[1]);
      node.channels = tokens.splice(2, numChannels);
      node.children = [];
    }

    while (true) {
      const line = this.nextLine(lines);

      if (line === "}") {
        return node;
      } else {
        node.children.push(this.readNode(lines, line, list));
      }
    }
  }

  toTHREEBone(source, list) {
    const bone = new THREE.Bone();
    list.push(bone);

    bone.position.add(source.offset);
    // 将冒号替换为下划线，以便与Three.js的PropertyBinding兼容
    bone.name = source.name.replace(/:/g, '_');

    if (source.type !== "ENDSITE") {
      for (let i = 0; i < source.children.length; i++) {
        bone.add(this.toTHREEBone(source.children[i], list));
      }
    }

    return bone;
  }

  toTHREEAnimation(bones, threeBones) {
    const tracks = [];

    // 创建骨骼名称到Three.js骨骼对象的映射
    const boneMap = {};
    for (let i = 0; i < threeBones.length; i++) {
      const bone = threeBones[i];
      boneMap[bone.name] = bone;
    }

    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];

      if (bone.type === "ENDSITE") continue;

      // 找到对应的Three.js骨骼（将冒号替换为下划线）
      const boneNameForMap = bone.name.replace(/:/g, '_');
      const threeBone = boneMap[boneNameForMap];
      if (!threeBone) {
        console.warn(`找不到对应的Three.js骨骼: ${bone.name} -> ${boneNameForMap}`);
        continue;
      }

      const times = [];
      const positions = [];
      const rotations = [];

      for (let j = 0; j < bone.frames.length; j++) {
        const frame = bone.frames[j];

        times.push(frame.time);

        positions.push(frame.position.x);
        positions.push(frame.position.y);
        positions.push(frame.position.z);

        rotations.push(frame.rotation.x);
        rotations.push(frame.rotation.y);
        rotations.push(frame.rotation.z);
        rotations.push(frame.rotation.w);
      }

      // 使用确切的骨骼名称创建轨道
      if (this.animateBonePositions) {
        tracks.push(
          new THREE.VectorKeyframeTrack(
            threeBone.name + ".position",
            times,
            positions
          )
        );
      }

      if (this.animateBoneRotations) {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            threeBone.name + ".quaternion",
            times,
            rotations
          )
        );
      }

      console.log(`为骨骼创建轨道: ${threeBone.name}`);
    }

    return new THREE.AnimationClip("animation", -1, tracks);
  }

  nextLine(lines) {
    let line;
    while ((line = lines.shift().trim()).length === 0) {}
    return line;
  }
}
