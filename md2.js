function sharedStart(array) {
    var A = array.slice(0).sort();
    word1 = A[0];
    word2 = A[A.length - 1];
    L = word1.length;
    i = 0;
    while (i < L && word1.charAt(i) === word2.charAt(i)) i++;
    return word1.substring(0, i);
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

function TexCoord(s, t) {
    this.s = s;
    this.t = t;
}

function Vertex(x, y, z, normalIndex) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.normalIndex = normalIndex;
}

function DataReader (dataview)  {
    this.dataview = dataview;
    this.position = 0;

    this.getUint8 = function() {
        result = this.dataview.getUint8(this.position, true);
        this.position += 1;
        return result;
    }

    this.getInt16 = function() {
        result = this.dataview.getInt16(this.position, true);
        this.position += 2;
        return result;
    }

    this.getInt32 = function() {
        result = this.dataview.getInt32(this.position, true);
        this.position += 4;
        return result;
    }

    this.getFloat32 = function() {
        result = this.dataview.getFloat32(this.position, true);
        this.position += 4;
        return result;
    }

    this.getChar = function() {
        return String.fromCharCode(this.getUint8());
    }

    this.getString = function(length) {
        codes = [];
        for (var i = 0; i < length; ++i) {
            c = this.getUint8();
            if (c > 0) {
                codes.push(c);
            }
        }
       
        return String.fromCharCode.apply(null, codes);
    }
}

function loadlistener() {
    if (this.readyState == 4 && this.status == 200) {
        var dr = new DataReader(new DataView(this.response));
        currentAnimation = 0;
        parseHeader(dr);
        parseModel(dr);

        initShaders();
        createBuffers();
        canvas.addEventListener( "keydown", onKeyDown, true);
        canvas.addEventListener("mousemove", onMouseMove, true);
        canvas.addEventListener("mousedown", onMouseDown, true);
        canvas.addEventListener("mouseup", onMouseUp, true);

        time = new Date().getTime();

        setInterval(function() {
            var t = new Date().getTime();
            var dt = t - time;
            time = t;

            fillBuffers();
            currentFrame = ( currentFrame + dt / 100.0 ) % animations[currentAnimation].length;
            drawScene();
            
        }, 16);

    }
}

mouseDown = false;
lastX = 0;

function onMouseDown(e) {
    mouseDown = true;
    lastX = e.clientX;
}

function onMouseUp(e) {
    mouseDown = false;
}

function onMouseMove(e) {
    if (mouseDown) {
        rotation += (e.clientX - lastX) / 2;
        lastX = e.clientX;
    }
}

function onKeyDown(e) {
    if (e.keyCode == 32) {
        currentFrame = 0;
        currentAnimation = (currentAnimation + 1) % animations.length;
    }
}



function parseHeader(dr) {
    hdr = {};
    hdr.ident = dr.getString(4);
    hdr.version = dr.getInt32();
    hdr.skinwidth = dr.getInt32();
    hdr.skinheight = dr.getInt32();
    hdr.framesize = dr.getInt32();
    hdr.num_skins = dr.getInt32();
    hdr.num_vertices = dr.getInt32();
    hdr.num_st = dr.getInt32();
    hdr.num_tris = dr.getInt32();
    hdr.num_glcmds = dr.getInt32();
    hdr.num_frames = dr.getInt32();
        
    hdr.offset_skins = dr.getInt32();
    hdr.offset_st = dr.getInt32();
    hdr.offset_tris = dr.getInt32();
    hdr.offset_frames = dr.getInt32();
    hdr.offset_glcmds = dr.getInt32();
    hdr.offset_end = dr.getInt32();

}

function parseModel(dr) {
    model = {};


    model.texCoords = []
    dr.position = hdr.offset_st;
    for (var i = 0; i < hdr.num_st; ++i) {
        s = dr.getInt16();
        t = dr.getInt16();
        st = new TexCoord(s, t);
        model.texCoords.push(st);
    }

    model.triangles = [];
    dr.position = hdr.offset_tris;
    for (var i = 0; i < hdr.num_tris; ++i) {
        triangle = {};
        triangle.vertex = [dr.getInt16(), dr.getInt16(), dr.getInt16()];
        triangle.st = [dr.getInt16(), dr.getInt16(), dr.getInt16()];
        
        model.triangles.push(triangle);
    }

    model.frames = [];
    dr.position = hdr.offset_frames;
    animations = [[]]
    
    for (var i = 0; i < hdr.num_frames; ++i) {
        frame = {};
        frame.scale = [dr.getFloat32(), dr.getFloat32(), dr.getFloat32()];
        frame.translate = [dr.getFloat32(), dr.getFloat32(), dr.getFloat32()];
        frame.name = dr.getString(16);
        if (i > 0) {
            prevName = model.frames[i - 1].name;
            if (prevName.substring(0, prevName.length - 3) != frame.name.substring(0, frame.name.length - 3)) {
                animations.push([]);
            }
        }
        animations[animations.length - 1].push(i);

        frame.verts = [];
        for (var j = 0; j < hdr.num_vertices; ++j) {
            vertex = {};
            vertex.v = [dr.getUint8(), dr.getUint8(), dr.getUint8()];
            vertex.normalIndex = dr.getUint8();
            frame.verts.push(vertex);
        }
        model.frames.push(frame);
    }
}



function createBuffers() {
    vertexBuffer = gl.createBuffer();
    coordBuffer = gl.createBuffer();

}

function fillBuffers() {
    vertices = [];
    coords = [];

    interp = currentFrame - Math.floor(currentFrame);
    f0 = animations[currentAnimation][0] + Math.floor(currentFrame);
    f1 = animations[currentAnimation][0] + (Math.floor(currentFrame) + 1) % animations[currentAnimation].length;
    current = model.frames[f0];
    next = model.frames[f1];

    for (var i = 0; i < hdr.num_tris; ++i) {
        for (var j = 0; j < 3; ++j) {
            index = model.triangles[i].vertex[j];
            st = model.texCoords[model.triangles[i].st[j]]

            for (var k = 0; k < 3; ++k) {
                v0 = current.scale[k] * current.verts[index].v[k] + current.translate[k];
                v1 = next.scale[k] * next.verts[index].v[k] + next.translate[k];
                vertices.push( v0 + interp * (v1 - v0));
            }
            coords.push(st.s / hdr.skinwidth, st.t / hdr.skinheight);
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, coordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);
    

}

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var pMatrix = mat4.create();
    mat4.identity(pMatrix);
    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    var mvMatrix = mat4.create();
    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix, [0.0, 0.0, -8.0]);
    mat4.scale(mvMatrix, [0.1, 0.1, 0.1]);
    mat4.rotate(mvMatrix, degToRad(-90), [1, 0, 0]);
    mat4.rotate(mvMatrix, degToRad(-90 + rotation), [0, 0, 1]);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
        
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, coordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    
    gl.drawArrays(gl.TRIANGLES, 0, hdr.num_tris * 3);

}

   function getShader(gl, id) {
        var shaderScript = document.getElementById(id);
        if (!shaderScript) {
            console.log("no shader element");
            return null;
        }

        var str = "";
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader;
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            return null;
        }

        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }


var shaderProgram;

function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);
    
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}


var canvas = document.getElementById("canv");
var gl = canvas.getContext("webgl");
gl.viewport(0, 0, canvas.width, canvas.height);
gl.viewportWidth = canvas.width;
gl.viewportHeight = canvas.height;

gl.clearColor(0.6, 0.6, 0.6, 1.0);
gl.enable(gl.DEPTH_TEST);

currentFrame = 0;
rotation = 0;

image = new Image();
image.onload = function() {
    console.log("image loaded");

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);


    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = loadlistener;
    xhr.open("get", "ogro.md2", true);
    xhr.responseType = 'arraybuffer'
    xhr.send();
};
image.src = "skin.jpg";


