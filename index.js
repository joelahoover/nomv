
exports.ds = {};

exports.run = function(resource_path) {
  function selectSong() {
  return $("#song-selector").val();
}

function initUI(scene) {
  $("#song-selector").on('change', function() {
    scene.next = selectSong();
  })
}

function initializeWebGL() {
  var canvas = document.getElementById("webglCanvas")

  var gl = canvas.getContext("webgl");
  if (!gl) {
    gl = canvas.getContext("experimental-webgl");
    if (!gl) {
      alert("Cannot get WebGL context!");
    }
  }

  return gl;
}

function createShader(gl, shaderScriptId) {
  var shaderScript = $("#" + shaderScriptId);
  var shaderSource = shaderScript[0].text;
  var shaderType = null;
  if (shaderScript[0].type == "x-shader/x-vertex") {
    shaderType = gl.VERTEX_SHADER;
  } else if (shaderScript[0].type == "x-shader/x-fragment") {
    shaderType = gl.FRAGMENT_SHADER;
  } else {
    throw new Error("Invalid shader type: " + shaderScript[0].type)
  }
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var infoLog = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("An error occurred compiling the shader: " + infoLog);
  } else {
    return shader;
  }
}

function createGlslProgram(gl, vertexShaderId, fragmentShaderId) {
  var program = gl.createProgram();
  gl.attachShader(program, createShader(gl, vertexShaderId));
  gl.attachShader(program, createShader(gl, fragmentShaderId));
  gl.linkProgram(program);
  gl.validateProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var infoLog = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("An error occurred linking the program: " + infoLog);
  } else {
    return program;
  }
}

function fetchTexture(scene, name) {
  function loadTexture(scene, name, image) {
    var gl = scene.gl;

    // Send image to GPU
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    scene.textures[name] = tex;
    scene.texturesToLoad -= 1;
  }

  // Fetch the texture
  scene.texturesToLoad += 1;
  var image = new Image();
  image.onload = loadTexture.bind(null, scene, name, image);
  image.crossOrigin = "";
  image.src = resource_path + "images/" + name;
}

function drawParticles(scene, arr, color, textureName) {
  var gl = scene.gl;
  // Use the shader
  gl.useProgram(scene.shaders.particle);

  // Use additive-blending
  gl.blendFunc(gl.ONE, gl.ONE);

  // Setup the buffers
  var vertexData = [];
  var indexData = [];
  for (var i = 0; i < arr.length; i++) {
    var xpos = arr[i].p.x;
    var ypos = arr[i].p.y;
    var clr = arr[i].c;
    var s = Math.sin(0);
    var c = Math.cos(0);
    var h = arr[i].s/2;
    vertexData = vertexData.concat([
      xpos+h*(-c+s), ypos+h*(-s-c), 0.0,  // Lower left
      0.0,  0.0,
      clr.r, clr.g, clr.b, clr.a,
      xpos+h*(c+s),  ypos+h*(s-c),  0.0,  // Lower right
      1.0,  0.0,
      clr.r, clr.g, clr.b, clr.a,
      xpos+h*(c-s),  ypos+h*(s+c),  0.0,  // Top right
      1.0,  1.0,
      clr.r, clr.g, clr.b, clr.a,
      xpos+h*(-c-s), ypos+h*(-s+c), 0.0,  // Top left
      0.0,  1.0,
      clr.r, clr.g, clr.b, clr.a
    ]);
    indexData = indexData.concat([
      4*i, 4*i+1, 4*i+2,
      4*i, 4*i+2, 4*i+3
    ]);
  }

  var vertexArray = new Float32Array(vertexData);
  var vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  var indexArray = new Uint16Array(indexData);
  var indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Setup the shader uniforms
  var pColorLoc = gl.getUniformLocation(scene.shaders.particle, "color");
  gl.uniform4f(pColorLoc, color.r, color.g, color.b, color.a);

  if(textureName !== undefined && textureName !== null) {
    var textureLoc = gl.getUniformLocation(scene.shaders.particle, "texture");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.textures[textureName]);
    gl.uniform1i(textureLoc, 0);
  } else {
    throw "Sprite must have a texture";
  }

  // Bind the attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  var vertPositionLocation = gl.getAttribLocation(scene.shaders.particle, "position");
  gl.enableVertexAttribArray(vertPositionLocation);
  gl.vertexAttribPointer(vertPositionLocation, 3, gl.FLOAT, false, 4*9, 0);
  var vertTextureLocation = gl.getAttribLocation(scene.shaders.particle, "texCoord");
  gl.enableVertexAttribArray(vertTextureLocation);
  gl.vertexAttribPointer(vertTextureLocation, 2, gl.FLOAT, false, 4*9, 4*3);
  var vertColorLocation = gl.getAttribLocation(scene.shaders.particle, "color");
  gl.enableVertexAttribArray(vertColorLocation);
  gl.vertexAttribPointer(vertColorLocation, 4, gl.FLOAT, false, 4*9, 4*5);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Draw!
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, arr.length*6, gl.UNSIGNED_SHORT, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Cleanup
  gl.disableVertexAttribArray(vertPositionLocation);
  gl.disableVertexAttribArray(vertTextureLocation);
  gl.disableVertexAttribArray(vertColorLocation);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteBuffer(vertexBuffer);
  gl.deleteBuffer(indexBuffer);
  gl.useProgram(null);
}

function drawSprite(scene, xpos, ypos, size, angle, color, textureName) {
  var gl = scene.gl;
  // Use the shader
  gl.useProgram(scene.shaders.sprite);

  // Use alpha-blending
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Setup the buffers
  var s = Math.sin(angle);
  var c = Math.cos(angle);
  var h = size/2;
  var vertexData = [
    xpos+h*(-c+s), ypos+h*(-s-c), 0.0,  // Lower left
    0.0,  0.0,
    xpos+h*(c+s),  ypos+h*(s-c),  0.0,  // Lower right
    1.0,  0.0,
    xpos+h*(c-s),  ypos+h*(s+c),  0.0,  // Top right
    1.0,  1.0,
    xpos+h*(-c-s), ypos+h*(-s+c), 0.0,  // Top left
    0.0,  1.0
  ];

  var vertexArray = new Float32Array(vertexData);
  var vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  var indexData = [0, 1, 2, 0, 2, 3];
  var indexArray = new Uint16Array(indexData);
  var indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Setup the shader uniforms
  var pColorLoc = gl.getUniformLocation(scene.shaders.sprite, "color");
  gl.uniform4f(pColorLoc, color.r, color.g, color.b, color.a);

  if(textureName !== undefined && textureName !== null) {
    var textureLoc = gl.getUniformLocation(scene.shaders.sprite, "texture");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.textures[textureName]);
    gl.uniform1i(textureLoc, 0);
  } else {
    throw "Sprite must have a texture";
  }

  // Bind the attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  var vertPositionLocation = gl.getAttribLocation(scene.shaders.sprite, "position");
  gl.enableVertexAttribArray(vertPositionLocation);
  gl.vertexAttribPointer(vertPositionLocation, 3, gl.FLOAT, false, 4*5, 0);
  var vertTextureLocation = gl.getAttribLocation(scene.shaders.sprite, "texCoord");
  gl.enableVertexAttribArray(vertTextureLocation);
  gl.vertexAttribPointer(vertTextureLocation, 2, gl.FLOAT, false, 4*5, 4*3);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Draw!
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Cleanup
  gl.disableVertexAttribArray(vertPositionLocation);
  gl.disableVertexAttribArray(vertTextureLocation);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteBuffer(vertexBuffer);
  gl.deleteBuffer(indexBuffer);
  gl.useProgram(null);
}

function drawAnimatedSprite(scene, xpos, ypos, size, angle, color, textureName, grid, time) {
  var gl = scene.gl;
  // Use the shader
  gl.useProgram(scene.shaders.sprite);

  // Use alpha-blending
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Setup the buffers
  var s = Math.sin(angle);
  var c = Math.cos(angle);
  var h = size/2;

  // get texture coordinates of frame in the sprite sheet
  spriteIndex = Math.floor(time * grid[0] * grid[1]);

  var col = (spriteIndex % grid[1]);
  var row = Math.floor(spriteIndex/grid[1]);

  var vertexData = [
  // the 0.99 is a hack because the texture is slightly off
  // but works well enough for what we are doing now
    xpos+h*(-c+s), ypos+h*(-s-c), 0.0,  // Lower left
    col/grid[0],  0.99 - (row + 1)/grid[1],
    xpos+h*(c+s),  ypos+h*(s-c),  0.0,  // Lower right
    (col+1)/grid[0],  0.99 - (row + 1)/grid[1],
    xpos+h*(c-s),  ypos+h*(s+c),  0.0,  // Top right
    (col+1)/grid[0],  0.99 - row/grid[1],
    xpos+h*(-c-s), ypos+h*(-s+c), 0.0,  // Top left
    col/grid[0],  0.99 - row/grid[1]
  ];

  var vertexArray = new Float32Array(vertexData);
  var vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  var indexData = [0, 1, 2, 0, 2, 3];
  var indexArray = new Uint16Array(indexData);
  var indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Setup the shader uniforms
  var pColorLoc = gl.getUniformLocation(scene.shaders.sprite, "color");
  gl.uniform4f(pColorLoc, color.r, color.g, color.b, color.a);

  if(textureName !== undefined && textureName !== null) {
    var textureLoc = gl.getUniformLocation(scene.shaders.sprite, "texture");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.textures[textureName]);
    gl.uniform1i(textureLoc, 0);
  } else {
    throw "Sprite must have a texture";
  }

  // Bind the attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  var vertPositionLocation = gl.getAttribLocation(scene.shaders.sprite, "position");
  gl.enableVertexAttribArray(vertPositionLocation);
  gl.vertexAttribPointer(vertPositionLocation, 3, gl.FLOAT, false, 4*5, 0);
  var vertTextureLocation = gl.getAttribLocation(scene.shaders.sprite, "texCoord");
  gl.enableVertexAttribArray(vertTextureLocation);
  gl.vertexAttribPointer(vertTextureLocation, 2, gl.FLOAT, false, 4*5, 4*3);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Draw!
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Cleanup
  gl.disableVertexAttribArray(vertPositionLocation);
  gl.disableVertexAttribArray(vertTextureLocation);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteBuffer(vertexBuffer);
  gl.deleteBuffer(indexBuffer);
  gl.useProgram(null);
}



function draw(scene) {
  var gl = scene.gl;

  var bgColor = scene.graph.globals.backgroundColor.color;

  gl.clearColor(bgColor.r, bgColor.g, bgColor.b, bgColor.a);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.CULL_FACE)

  // Enable blending
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Disable depth testing
  gl.disable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);

  for(n of scene.graph.nodes) {
    n.draw(scene);
  }
}

function initAudio(audio) {
  try {
    // Fix up for prefixing
    window.AudioContext = window.AudioContext||window.webkitAudioContext;
    audio.context = new AudioContext();
  }
  catch(e) {
    alert('Web Audio API is not supported in this browser');
  }

  // Asynchronous callback
  function onAudioLoad(e) {
    if (audio.soundSource === undefined) {
    // create a sound source
      audio.soundSource = audio.context.createMediaElementSource(audio.element);
    } else {
      audio.soundSource.disconnect();
    }

    // Connectors
    audio.soundSource.connect(audio.analyser);
    audio.soundSource.connect(audio.splitter);

    // Sound is loaded and ready to start playing
    audio.loaded = true;
  };

  function onAudioStart(e) {
    audio.playing = true;
  }

  function onAudioStop(e) {
    audio.playing = false;
  }

  audio.element = document.getElementById('audioElement');
  audio.element.addEventListener('loadedmetadata', onAudioLoad, true);
  audio.element.addEventListener('play', onAudioStart, true);
  audio.element.addEventListener('pause', onAudioStop, true);

  audio.analyser = audio.context.createAnalyser();
  audio.analyser.smoothingTimeConstant = 0.8;
  audio.analyser.fftSize = 4096;

  audio.analyserL = audio.context.createAnalyser();
  audio.analyserL.smoothingTimeConstant = 0.8;
  audio.analyserL.fftSize = 4096;

  audio.analyserR = audio.context.createAnalyser();
  audio.analyserR.smoothingTimeConstant = 0.8;
  audio.analyserR.fftSize = 4096;

  audio.splitter = audio.context.createChannelSplitter(2);

  // Connectors
  audio.analyser.connect(audio.context.destination);

  audio.splitter.connect(audio.analyserL, 0);
  audio.splitter.connect(audio.analyserR, 1);

  audio.getCurrentTime = function() {
    return audio.element.currentTime;
  }
}

$("#webglCanvas").keydown(function (event) {

    ds.audio.freqData = new Float32Array(ds.audio.analyser.frequencyBinCount);
    ds.audio.analyser.getFloatFrequencyData(ds.audio.freqData);
    var sum = ds.audio.freqData.reduce(function (a, b) {
      return a + b;
    }, 0);
    var avg = sum / ds.audio.analyser.frequencyBinCount;
    console.log(ds);
});

function normalizeSongData(song) {
  for (var name in song.data) {
    var data = song.data[name];
    switch(data.type) {
      case "array":
        // No processing needed
        break;
      case "structuredArray":
        // Memoizing array constructor
        subarrays = {};
        function expandValues(name) {
          if(subarrays[name] !== undefined) {
            return subarrays[name];
          } else {
            arr = [];
            for (var idx in data.arrays[name]) {
              var val = data.arrays[name][idx];
              if(typeof(val) == "string") {
                // Process subarray
                arr = arr.concat(expandValues(val));
              } else {
                // Just a value
                arr.push(val);
              }
            }
            subarrays[name] = arr;
            return arr;
          }
        }

        // Expand the structured array into a regular array
        data.data = expandValues("root");
        break;
      default:
        throw "Error: Unidentified data type";
    }
  }
}

function sampleData(song, name, sample) {
  function nameData(names, data) {
    if(names !== undefined && names !== null) {
      var obj = {};
      for (i in data) {
        obj[names[i]] = data[i];
      }
      return obj;
    } else {
      // If not naming, return the data unchanged
      return data;
    }
  }

  function sampleArray(source) {
    var len = source.data.length;
    switch (source.wrap) {
      case "clamp":
        sample = Math.max(0, Math.min(len-1, sample));
        break;
      case "repeat":
        sample = ((sample % len) + len) % len;
        break;
      default:
        throw "Unhandled wrap mode: '" + source.wrap + "'";
    }
    return source.data[sample];
  }

  var source = song.data[name];
  switch (source.type) {
    case "array":
      return nameData(source.names, sampleArray(source));
    case "structuredArray":
      // We already constructed a regular array from the structured array,
      // so no special processing here is needed.
      return nameData(source.names, sampleArray(source));
    default:
      throw "Unhandled source data type: '" + source.type + "'";
  }
}

function sampleInterpolatedData(song, name, rate, time, method) {
  var t = rate * time / 1000;
  switch (method) {
    case "nearest":
      return sampleData(song, name, Math.round(t));
    case "floor":
      return sampleData(song, name, Math.floor(t));
    case "linear":
      frac = t%1;
      p1 = sampleData(song, name, Math.floor(t));
      p2 = sampleData(song, name, Math.ceil(t));
      function linearInterpolate(x, y) {
        switch (typeof x) {
          case "number":
            return x * (1-frac) + y * frac;
          case "object":
            // This works for both objects and arrays
            var ret = {};
            for (var idx in x) {
              ret[idx] = linearInterpolate(x[idx], y[idx]);
            }
            return ret;
          default:
            throw "Error: Unsupported type '" + typeof (x) + "' in interpolated object"
        }
      }
      return linearInterpolate(p1, p2);
    case "catmull-rom":
      frac = t%1;
      p0 = sampleData(song, name, Math.floor(t)-1);
      p1 = sampleData(song, name, Math.floor(t)+0);
      p2 = sampleData(song, name, Math.floor(t)+1);
      p3 = sampleData(song, name, Math.floor(t)+2);

      // Define our interpolation function
      var timevector = vec4.fromValues(Math.pow(frac,3), Math.pow(frac,2), frac, 1);
      var interpmatrix = mat4.fromValues(-1, 2, -1, 0, 3, -5, 0, 2, -3, 4, 1, 0, 1, -1, 0, 0);
      interpmatrix = mat4.multiplyScalar(interpmatrix, interpmatrix, 0.5);
      function cmInterpolate(a, b, c, d) {
        switch (typeof a) {
          case "number":
            var temp = vec4.fromValues(a, b, c, d);
            vec4.transformMat4(temp, temp, interpmatrix);
            return vec4.dot(timevector, temp);
          case "object":
            // This works for both objects and arrays
            var ret = {};
            for (var idx in a) {
              ret[idx] = cmInterpolate(a[idx], b[idx], c[idx], d[idx]);
            }
            return ret;
          default:
            throw "Error: Unsupported type '" + typeof (x) + "' in interpolated object"
        }
      }

      return cmInterpolate(p0, p1, p2, p3);
    default:
      throw "Unhandled interpolation mode: '" + method + "'";
  }
}

function loadGraph(scene) {
  graph = { "nodes": [], "nameToIndex": {} }

  // Helper function to lookup a node
  function resolveNodeSkel(index, nodeName) {
    var idx = +graph.nameToIndex[nodeName];
    argh = [idx, +index]
    if(Number.isNaN(idx)) {
      throw "Unable to get index for node '" + nodeName + "'. (Is the node name misspelled?)";
    }
    if(index !== undefined && idx > +index) {
      throw "Unable to get index for node '" + nodeName + "'. (Are the nodes out of order?)";
    }
    if(index !== undefined && idx == +index) {
      throw "Unable to get index for node '" + nodeName + "'. (Is the node trying to reference itself?)";
    }
    return (dataContext) => dataContext.values[idx];
  }

  // Helper function for getting either a value or data from another node,
  // or return the default
  function resolveValueOrNodeSkel(index, val, valDefault) {
    switch (typeof(val)) {
      case "string":
        return resolveNodeSkel(index, val);
      case "undefined":
        if (valDefault === undefined) {
          throw "Unable to get value'" + val + "'";
        }
        return () => valDefault;
      default:
        return () => val;
    }
  }

  // Setup mapping for node names
  graph.nameToIndex = {};
  scene.song.nodes.forEach((n, i) => {
    graph.nameToIndex[n.name] = i;
  });

  // Create the nodes
  for (i in scene.song.nodes) {
    // The node json definition
    var n = scene.song.nodes[i];

    var resolveNode = resolveNodeSkel.bind(null, i);
    var resolveLastNode = resolveNodeSkel.bind(null, undefined);
    var resolveValueOrNode = resolveValueOrNodeSkel.bind(null, i);
    var resolveValueOrLastNode = resolveValueOrNodeSkel.bind(null, undefined);

    // Create the actual node object
    var node = {};
    switch (n.type) {
      case "data":
        config = {}
        config.source = n.source;
        config.rate = n.rate;
        if(n.time !== undefined) {
          var idx = graph.nameToIndex[n.time];
          config.time = (dc) => dc.values[idx] * 1000;
        } else {
          config.time = (dc) => dc.time;
        }
        if(n.interpolation !== undefined) {
          config.interp = n.interpolation;
        } else {
          config.interp = "nearest";
        }
        node.config = config;

        node.init = function(dc) {
          var c = this.config;
          return sampleInterpolatedData(scene.song, c.source, c.rate, c.time(dc), c.interp);
        };
        node.update = node.init;
        node.draw = function() {};
        break;
      case "time":
        config = {}
        switch (n.units) {
          case "s":
            config.divisor = 1000;
            break;
          case "ms":
            config.divisor =  1;
            break;
          default:
            throw "Unrecognized unit type '" + n.units + "'"
        }
        node.config = config;

        node.init = function(dc) { return dc.time / this.config.divisor; };
        node.update = node.init;
        node.draw = function() {};
        break;
      case "delay":
        config = {}
        config.initialValue = n.initialValue;
        config.source = resolveLastNode(n.source);
        node.config = config;

        node.init = function() { return this.config.initialValue; };
        node.update = function(_,ldc) { return this.config.source(ldc); };
        node.draw = function() {};
        break;
      case "javascript":
        config = {};
        config.n = n;
        config.func = eval(n.func);
        config.args = n.args.map((a) => { return graph.nameToIndex[a]; });
        node.config = config;

        node.init = function(dc) {
          var c = this.config;
          var args = c.args.map((a) => { return dc.values[a]; });
          v = c.func.apply(null, args);
          //if(this.config.n.name === "puckStateN") console.log(dc,this,v);
          return v;
        };
        node.update = node.init;
        node.draw = function() {};
        break;
      case "drawSprite":
        config = {}
        config.position = resolveValueOrNode(n.position, {"x": 0, "y": 0});
        config.size = resolveValueOrNode(n.size, 1);
        config.color = resolveValueOrNode(n.color, {"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0});
        config.angle = resolveValueOrNode(n.angle, 0);
        config.texture = n.texture;
        node.config = config;

        fetchTexture(scene, config.texture);

        node.init = function() {};
        node.update = function(dc) {
          var c = this.config;
          var state = {};
          state.pos = c.position(dc);
          state.size = c.size(dc);
          state.color = c.color(dc);
          state.angle = c.angle(dc);

          this.state = state;
          return null;
        };
        node.draw = function(scene) {
          var s = this.state;
          drawSprite(scene, s.pos.x, s.pos.y, s.size, s.angle, s.color, this.config.texture);
        };
        break;
      case "drawAnimatedSprite":
        var config = {}
        config.position = resolveValueOrNode(n.position, {"x": 0, "y": 0});
        config.size = resolveValueOrNode(n.size, 1);
        config.color = resolveValueOrNode(n.color, {"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0});
        config.angle = resolveValueOrNode(n.angle, 0);
        config.texture = n.texture;
        config.grid = n.grid;   // grid is a pair of integers that specify the number of rows and columns (r,c)
        config.time = resolveValueOrNode(n.time, 0); // time is normalized from 0 to 1
        node.config = config;

        fetchTexture(scene, config.texture);

        node.init = function() {};
        node.update = function(dc) {
          var c = this.config;
          var state = {};
          state.pos = c.position(dc);
          state.size = c.size(dc);
          state.color = c.color(dc);
          state.angle = c.angle(dc);
          state.time = c.time(dc);

          this.state = state;
          return null;
        };
        node.draw = function(scene) {
          var s = this.state;
          drawAnimatedSprite(scene, s.pos.x, s.pos.y, s.size, s.angle, s.color, this.config.texture, this.config.grid, s.time);
        };
        break;
      case "soundIntensity":
        config = {}
        config.range = n.range || [0.0, 1.0];
        switch (n.channel || "both") {
          case "both":
            config.analyser = scene.audio.analyser;
            break;
          case "left":
            config.analyser = scene.audio.analyserL;
            break;
          case "right":
            config.analyser = scene.audio.analyserR;
            break;
          default:
            throw "Unrecognized channel config: " + n.channel;
        }
        config.floor = 0.3;

        node.config = config;

        node.init = function() { return this.config.floor; }
        node.update = function() {
          var range = this.config.range;
          var lowBound = Math.floor(range[0]*this.config.analyser.frequencyBinCount);
          var highBound = Math.floor(range[1]*this.config.analyser.frequencyBinCount);

          var freqData = new Float32Array(this.config.analyser.frequencyBinCount);
          this.config.analyser.getFloatFrequencyData(freqData);
          var freqDataSlice = freqData.slice(lowBound, highBound);
          var sum = freqDataSlice.reduce(function (a, b) {
            return a + b;
          }, 0);
          var avg = sum / freqDataSlice.length;
          avg = avg + 150;
          avg = avg / 90;
          if (avg < this.config.floor) {
            avg = this.config.floor;
          }
          return avg;
        };
        node.draw = function() {};
        break;
      case "mousePosition": // TODO: Promote this to be a global
        var currentMousePos = {"x": 0.0, "y": 0.0};

        $("#webglCanvas").mousemove(function(e){
          currentMousePos = {}
          currentMousePos.x = e.pageX - $(this).offset().left;
          currentMousePos.y = e.pageY - $(this).offset().top;
          currentMousePos.y = $(this).height() - currentMousePos.y;
        });

        node.init = function() { return {"x": 0, "y": 0}; }
        node.update = function() {
          return {"x": currentMousePos.x/400 - 1, "y": currentMousePos.y/400 - 1};
        }
        node.draw = function() {};
        break;
      case "particle":
        var config = {};
        config.texture = n.texture;;
        config.resolveFunc = resolveValueOrNode(n.drawArray, null);
        node.config = config;

        fetchTexture(scene, config.texture);

        node.init = function(dc) {};
        node.update = function(dc) {
          var c = this.config;
          var drawArray = c.resolveFunc(dc);
          c.drawArray = drawArray;
        };
        node.draw = function(dc) {
          yea = dc;
          var d = this.config.drawArray;
          drawParticles(scene, d, {'r':1, 'g':1, 'b':1, 'a':1}, this.config.texture);
        };
        break;
      default:
        throw "Unrecognized node type: '" + n.type + "'";
    }

    // Add the node to the graph
    graph.nodes.push(node);
  }

  var resolveValueOrNode = resolveValueOrNodeSkel.bind(null, undefined);
  graph.globals = {};

  graph.globals.backgroundColor = {
    "config": {
      "color": resolveValueOrNode(scene.song.backgroundColor, {'r':.25, 'g':.2, 'b':.2, 'a':1})
    },
    "update": function(dataContext) {
      this.color = this.config.color(dataContext);
    }
  };

  scene.graph = graph;
}

function update(scene, currentTime) {
  // Update the data in the scene's graph
  scene.time = currentTime * 1000;
  var dataContext = { "time" : scene.time, "values": [] };
  for(n of scene.graph.nodes) {
    dataContext.values.push(n.update(dataContext, scene.lastDataContext));
  }
  scene.graph.globals.backgroundColor.update(dataContext, scene.lastDataContext);
  scene.lastDataContext = dataContext;
}

var ds; // Scene object for debugging
function initialize() {
  var scene = ds = exports.ds = {
    "time": 0,
    "song": null,
    "graph": null,
    "shaders": {},
    "textures": {},
    "texturesToLoad": 0,
    "audio": { "loaded": false, "playing": false },
    "isLoaded": function() {
      return this.graph !== null && this.texturesToLoad === 0 && this.audio.loaded === true;
    },
    "next": null
  };
  scene.gl = initializeWebGL();
  initAudio(scene.audio);
  initUI(scene);

  scene.shaders.sprite = createGlslProgram(scene.gl, "vertexShaderSprite", "fragmentShaderSprite");
  scene.shaders.particle = createGlslProgram(scene.gl, "vertexShaderParticle", "fragmentShaderParticle");

  window.requestAnimationFrame(animationFrame.bind(null, scene));
}

function loadAudio(scene) {
  scene.audio.title = scene.song.songTitle || "jupiter-lightning.mp3";
  if ($('#audioSource').length) {
    var source = $('#audioSource')[0];
    source.crossOrigin = "anonymous";
    source.src = resource_path + 'songs/' + scene.audio.title;
    scene.audio.element.load();
  } else {
    scene.audio.element.crossOrigin = "anonymous";
    var source = document.createElement('source');
    source.type = 'audio/mpeg';
    source.crossOrigin = "anonymous";
    source.src = resource_path + 'songs/' + scene.audio.title;
    source.id = "audioSource";
    scene.audio.element.appendChild(source);
  }
}

function animationFrame(scene, lastTime) {
  if(scene.next !== null) {
    var next = scene.next;

    scene.next = null;
    scene.loaded = false;
    scene.graph = null;
    scene.song = null;

    $.getJSON(resource_path + "songs/" + next + ".json?" + (Date.now() % 100000), function(newdata, status){
      if (status == "success") {
        scene.song = newdata;
        normalizeSongData(scene.song);
        loadAudio(scene);
        loadGraph(scene);
        scene.lastDataContext = scene.graph.nodes.reduce((dc, n) => {
          dc.values.push(n.init(dc));
          return dc;
        }, { "time" : 0, "values": [] });
      } else {
        alert("Failed to load song json: " + status);
      }
    });
  }

  if(scene.isLoaded() && scene.audio.playing) {
    update(scene, scene.audio.getCurrentTime());
    draw(scene);
  }

  window.requestAnimationFrame(animationFrame.bind(null, scene));
}

window.requestAnimationFrame(initialize);
}
