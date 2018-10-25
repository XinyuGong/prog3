/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/spheres.json"; // spheres file loc
var eye = new vec3.fromValues(0.5, 0.5, -0.5); // default eye position in world space
var lookAt = new vec3.fromValues(0.0, 0.0, 1.0);
var lookUp = new vec3.fromValues(0.0, 1.0, 0.0);

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader
var ambBuffer;
var difBuffer;
var speBuffer;
var vertexColorAmbAttrib;
var vertexColorDifAttrib;
var vertexColorSpeAttrib;
var normalBuffer;
var vertexNormalAttrib;
var nBuffer;
var vertexNAttrib;
var transBuffer;
var transAttrib;
var viewMatrix = mat4.create();
var normalMatrix = mat4.create();
var projectionMatrix = mat4.create();
var lightLoc;
var modelViewLoc;
var normalMatrixLoc;
var projectionLoc;
var isHighlighting = false;
var inHighlight = -1;
var inputTriangles;
var centerArray = [];
var transArray = [];
var models = [];



// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var indexArray = []; // 1D array of vertex indices for WebGL
        var ambArray = [];
        var difArray = [];
        var speArray = [];
        var normalArray = [];
        var nArray = [];
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var ambToAdd = [];
        var difToAdd = [];
        var speToAdd = [];
        var nrmToAdd = [];
        var nToAdd;
        
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            var vertices = inputTriangles[whichSet].vertices;
            centerArray.push(getCenter(vertices));

            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                ambToAdd = inputTriangles[whichSet].material.ambient;
                difToAdd = inputTriangles[whichSet].material.diffuse;
                speToAdd = inputTriangles[whichSet].material.specular;
                nrmToAdd = inputTriangles[whichSet].normals[whichSetVert];
                nToAdd = inputTriangles[whichSet].material.n;
                coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
                ambArray.push(ambToAdd[0], ambToAdd[1], ambToAdd[2]);
                difArray.push(difToAdd[0], difToAdd[1], difToAdd[2]);
                speArray.push(speToAdd[0], speToAdd[1], speToAdd[2]);
                normalArray.push(nrmToAdd[0], nrmToAdd[1], nrmToAdd[2]);
                nArray.push(nToAdd);
                transArray.push(new mat4.create());
            } // end for vertices in set
            
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd,indexOffset,inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0],triToAdd[1],triToAdd[2]);
            } // end for triangles in set

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris
        } // end for each triangle set 
        triBufferSize *= 3; // now total number of indices

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        // color
        ambBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ambBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambArray), gl.STATIC_DRAW);
        difBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, difBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(difArray), gl.STATIC_DRAW);
        speBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, speBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(speArray), gl.STATIC_DRAW);

        // normal
        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        // n
        nBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);

        // transformation
        transBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, transBuffer);console.log(transArray);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(transArray), gl.STATIC_DRAW);
        
        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer

    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;

        varying vec3 fragColorAmb;
        varying vec3 fragColorDif;
        varying vec3 fragColorSpe;
        varying vec3 normalInterp;
        varying vec3 vertPos;
        varying float n;

        uniform vec3 lightPos;

        void main(void) {
            vec3 normal = normalize(normalInterp);
            vec3 lightDir = normalize(lightPos - vertPos);
            
            float lambertian = max(dot(lightDir, normal), 0.0);
            float specular = 0.0;

            if (lambertian > 0.0) {
                vec3 viewDir = normalize(-vertPos);

                // blinn phong:
                vec3 halfDir = normalize(lightDir + viewDir);
                float specAngle = max(dot(halfDir, normal), 0.0);
                specular = pow(specAngle, n);
            }

            gl_FragColor = vec4(fragColorAmb + lambertian * fragColorDif + specular * fragColorSpe, 1.0);
            //gl_FragColor = vec4(1.0,1.0,1.0,1.0);
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexColorAmb;
        attribute vec3 vertexColorDif;
        attribute vec3 vertexColorSpe;
        attribute vec3 vertexNormal;
        attribute float vertexN;

        attribute mat4 transMatrix;

        uniform mat4 modelView, normalMat, projection;

        varying vec3 fragColorAmb;
        varying vec3 fragColorDif;
        varying vec3 fragColorSpe;
        varying vec3 normalInterp;
        varying vec3 vertPos;
        varying float n;

        void main(void) {
            //gl_Position = projection * modelView * (transMatrix * vec4(vertexPosition, 1.0));
            gl_Position = projection * modelView * vec4(vertexPosition, 1.0);
            fragColorAmb = vertexColorAmb;
            fragColorDif = vertexColorDif;
            fragColorSpe = vertexColorSpe;
            n = vertexN;
            //vec4 vertPos4 = modelView * (transMatrix * vec4(vertexPosition, 1.0));
            vec4 vertPos4 = modelView * vec4(vertexPosition, 1.0);
            vertPos = vec3(vertPos4) / vertPos4.w;
            normalInterp = vec3(normalMat * normalize(transMatrix * vec4(vertexNormal, 0.0)));
            //normalInterp = vec3(normalMat * vec4(vertexNormal, 0.0));
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                
                // projection
                mat4Perspective(projectionMatrix, 90, 1.0, 0.5, 1.5);
                projectionLoc = gl.getUniformLocation(shaderProgram, 'projection');
                gl.uniformMatrix4fv(projectionLoc, false, projectionMatrix);

                // color attributes
                vertexColorAmbAttrib = gl.getAttribLocation(shaderProgram, 'vertexColorAmb');
                gl.enableVertexAttribArray(vertexColorAmbAttrib);
                vertexColorDifAttrib = gl.getAttribLocation(shaderProgram, 'vertexColorDif');
                gl.enableVertexAttribArray(vertexColorDifAttrib);
                vertexColorSpeAttrib = gl.getAttribLocation(shaderProgram, 'vertexColorSpe');
                gl.enableVertexAttribArray(vertexColorSpeAttrib);

                // normal attributes
                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, 'vertexNormal');
                gl.enableVertexAttribArray(vertexNormalAttrib);

                // n
                vertexNAttrib = gl.getAttribLocation(shaderProgram, 'vertexN');
                gl.enableVertexAttribArray(vertexNAttrib);

                // transformation
                /*transAttrib = gl.getAttribLocation(shaderProgram, 'transMatrix');console.log(transAttrib);
                for (var ii = 0; ii < 4; ++ii) {
                    gl.enableVertexAttribArray(transAttrib + ii);
                }*/

                mat4LookAt(viewMatrix);
                mat4.invert(normalMatrix, viewMatrix);
                mat4.transpose(normalMatrix, normalMatrix);
                modelViewLoc = gl.getUniformLocation(shaderProgram, 'modelView');
                normalMatrixLoc = gl.getUniformLocation(shaderProgram, 'normalMat');
                
                gl.uniformMatrix4fv(modelViewLoc, false, viewMatrix);
                gl.uniformMatrix4fv(normalMatrixLoc, false, normalMatrix);

                // light
                lightLoc = gl.getUniformLocation(shaderProgram, 'lightPos');
                gl.uniform3fv(lightLoc, [-0.5, 0, 0]);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

var bgColor = 0;
// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    //bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    //gl.clearColor(bgColor, 0, 0, 1.0);
    //requestAnimationFrame(renderTriangles);
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    // color
    gl.bindBuffer(gl.ARRAY_BUFFER,ambBuffer); // activate
    gl.vertexAttribPointer(vertexColorAmbAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER,difBuffer); // activate
    gl.vertexAttribPointer(vertexColorDifAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER,speBuffer); // activate
    gl.vertexAttribPointer(vertexColorSpeAttrib,3,gl.FLOAT,false,0,0); // feed

    // normal
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

    // n
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.vertexAttribPointer(vertexNAttrib, 1, gl.FLOAT, false, 0, 0);

    // transformation
    /*gl.bindBuffer(gl.ARRAY_BUFFER, transBuffer);
    gl.vertexAttribPointer(transAttrib, 4, gl.FLOAT, false, 64, 0);
    gl.vertexAttribPointer(transAttrib + 1, 4, gl.FLOAT, false, 64, 16);
    gl.vertexAttribPointer(transAttrib + 2, 4, gl.FLOAT, false, 64, 32);
    gl.vertexAttribPointer(transAttrib + 3, 4, gl.FLOAT, false, 64, 48);*/

    //gl.drawArrays(gl.TRIANGLES,0,3); // render
    // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
} // end render triangles

function  mat4LookAt(viewMatrix) {
    var right = new vec3.create();
    vec3.cross(right, lookAt, lookUp);
    vec3.normalize(right, right);

    mat4.set(
        viewMatrix,
        right[0], lookUp[0], -lookAt[0], 0.0,
        right[1], lookUp[1], -lookAt[1], 0.0,
        right[2], lookUp[2], -lookAt[2], 0.0,
        -vec3.dot(right, eye), -vec3.dot(lookUp, eye), vec3.dot(lookAt, eye), 1.0
    );
}

function mat4Perspective(a, fov, aspect, zNear, zFar) {
    var f = 1.0 / Math.tan (fov/2.0 * (Math.PI / 180.0));
    a[0] = f / aspect;
    a[1 * 4 + 1] = f;
    a[2 * 4 + 2] = (zFar + zNear)  / (zNear - zFar);
    a[3 * 4 + 2] = (2.0 * zFar * zNear) / (zNear - zFar);
    a[2 * 4 + 3] = -1.0;
    a[3 * 4 + 3] = 0.0;
}

// keyboard handler
function keyDownHandler(event) {
    switch(event.key) {
        case 'a': transX(-0.1); break; // translate view left
        case 'd': transX(0.1); break; // translate view right
        case 'q': transY(0.1); break; // translate view up
        case 'e': transY(-0.1); break; // translate view down
        case 'w': transZ(0.1); break; // translate view forward
        case 's': transZ(-0.1); break; // translate view backward
        case 'A': rotateY(5); break; // rotate view left
        case 'D': rotateY(-5); break; // rotate view right
        case 'W': rotateX(5); break; // rotate view up
        case 'S': rotateX(-5); break; // rotate view down
    }

    setupShaders();
    renderTriangles();
}

// view translation
function transX(amount) { // move right if amount > 0
    var right = new vec3.create();
    vec3.cross(right, lookAt, lookUp);
    vec3.normalize(right, right);
    
    var trans = new vec3.create();
    vec3.scale(trans, right, amount);
    vec3.add(eye, eye, trans);
}

function transY(amount) { // move up if amount > 0
    var trans = new vec3.create();
    vec3.scale(trans, lookUp, amount);
    vec3.add(eye, eye, trans);
}

function transZ(amount) { // move forward if amount > 0
    var trans = new vec3.create();
    vec3.scale(trans, lookAt, amount);
    vec3.add(eye, eye, trans);
}

// view rotation, angle in degrees
function rotateY(deg) { // turn left if deg > 0
    var w = new mat3.fromValues(
        0, lookUp[2], -lookUp[1],
        -lookUp[2], 0, lookUp[0],
        lookUp[1], -lookUp[0], 0
    );
    var a = new mat3.create();
    var b = new mat3.create();

    mat3.multiplyScalar(a, w, Math.sin(deg / 180 * Math.PI));
    mat3.mul(b, w, w);
    mat3.multiplyScalar(b, b, 2 * Math.sin(deg / 360 * Math.PI) * Math.sin(deg / 360 * Math.PI));

    var rotMat = new mat3.create();
    mat3.add(rotMat, rotMat, a);
    mat3.add(rotMat, rotMat, b);
    
    vec3.transformMat3(lookAt, lookAt, rotMat);
}

function rotateX(deg) { // turn up if deg > 0
    var right = new vec3.create();
    vec3.cross(right, lookAt, lookUp);
    vec3.normalize(right, right);

    var w = new mat3.fromValues(
        0, right[2], -right[1],
        -right[2], 0, right[0],
        right[1], -right[0], 0
    );
    var a = new mat3.create();
    var b = new mat3.create();

    mat3.multiplyScalar(a, w, Math.sin(deg / 180 * Math.PI));
    mat3.mul(b, w, w);
    mat3.multiplyScalar(b, b, 2 * Math.sin(deg / 360 * Math.PI) * Math.sin(deg / 360 * Math.PI));

    var rotMat = new mat3.create();
    mat3.add(rotMat, rotMat, a);
    mat3.add(rotMat, rotMat, b);
    
    vec3.transformMat3(lookAt, lookAt, rotMat);
    vec3.transformMat3(lookUp, lookUp, rotMat);
}

// highlight
function highlightOn(next) { // highlight next one if next = 1, otherwise the previous one

}

function highlightOff() {
    if (isHighlighting) {
        isHighlighting = false;
        var vertices = inputTriangles[inHighlight].vertices;
        var center = getCenter(vertices);
    }
}

function getCenter(vertices) {
    var coord = [[], [], []];
    for (var i = 0; i < 3; i ++) {
        for (var j = 0; j < vertices.length; j ++) {
            coord[i].push(vertices[j][i]);
        }
    }
    var center = new vec3.fromValues(
        (Math.max(coord[0]) + Math.min(coord[0])) / 2,
        (Math.max(coord[1]) + Math.min(coord[1])) / 2,
        (Math.max(coord[2]) + Math.min(coord[2])) / 2
    );
    return center;
}

/* MAIN -- HERE is where execution begins after window load */

function main() {

    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL

    document.addEventListener('keydown', keyDownHandler, false);

    var a = vec3.fromValues(1,0,0);
    var b = vec3.fromValues(0,0,1);
    var res = new vec3.create();
    var tmp = new mat3.create();
    console.log(tmp);
    vec3.cross(res, a, b);
    console.log(res);
    console.log(Math.sin(Math.PI/2));

} // end main
