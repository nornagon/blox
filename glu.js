// sylvester hax
Matrix.prototype.flatten = function () {
	var result = []
	if (this.elements.length == 0) {
		return []
	}

	for (var j = 0; j < this.elements[0].length; j++) {
		for (var i = 0; i < this.elements.length; i++) {
			result.push(this.elements[i][j]);
		}
	}
	return result;
}

Matrix.Translation = function (x,y,z) {
	return $M([
		[1, 0, 0, x],
		[0, 1, 0, y],
		[0, 0, 1, z],
		[0, 0, 0, 1]
	])
}

var glu = function (canvas) {
	var gl = null
	var types = ['webgl', 'experimental-webgl', 'webkit-3d', 'moz-webgl']
	for (var i = 0; i < types.length; i++) {
		try {
			gl = canvas.getContext(types[i], { antialias: false })
		} catch (e) {
		}
		if (gl) {
			break
		}
	}

	gl.u = {}

	// Compiles a shader from source in a
	// <script type='x-shader/x-{vertex,fragment}'> tag
	gl.u.getShader = function (id) {
		var el = document.getElementById(id)
		if (!el) { return }
		var source = ""
		for (var node = el.firstChild; node; node = node.nextSibling) {
			source += node.textContent
		}
		var shader
		if (el.type === 'x-shader/x-fragment') {
			shader = gl.createShader(gl.FRAGMENT_SHADER)
		} else if (el.type === 'x-shader/x-vertex') {
			shader = gl.createShader(gl.VERTEX_SHADER)
		} else {
			return
		}
		gl.shaderSource(shader, source)
		gl.compileShader(shader)
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.log("Error compiling the shader '"+id+"': "+gl.getShaderInfoLog(shader))
			return
		}

		return shader
	}

	function ShaderProgram(program) {
		this.program = program
	}

	ShaderProgram.prototype.use = function () {
		gl.useProgram(this.program)
	}
	ShaderProgram.prototype.uniform = function (uname, value) {
		this.use()
		var loc = gl.getUniformLocation(this.program, uname)
		if (!loc) {
			throw new Error("No such uniform: " + uname)
		}
		if (value instanceof Matrix) {
			if (value.rows() === 4 && value.cols() === 4) {
				gl.uniformMatrix4fv(loc, false, new Float32Array(value.flatten()))
			} else if (value.rows() === 3 && value.cols() === 3) {
				gl.uniformMatrix3fv(loc, false, new Float32Array(value.flatten()))
			} else {
				console.log("don't know how to set a uniform to",value)
			}
		} else if (value instanceof Array) {
			if (value.length === 3) {
				gl.uniform3fv(loc, value)
			} else if (value.length === 4) {
				gl.uniform4fv(loc, value)
			} else {
				console.log("don't know how to set a uniform to",value)
			}
		} else {
			console.log("don't know how to set a uniform to",value)
		}
	}
	ShaderProgram.prototype.attrLoc = function (aname) {
		this.use()
		return gl.getAttribLocation(this.program, aname)
	}

	gl.u.createProgram = function (vertId, fragId) {
		var vert = gl.u.getShader(vertId)
		var frag = gl.u.getShader(fragId)

		if (vert === undefined || frag === undefined) { return }

		var program = gl.createProgram()
		gl.attachShader(program, vert)
		gl.attachShader(program, frag)
		gl.linkProgram(program)

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.log("Couldn't link shaders: "+gl.getProgramInfoLog(program))
			return
		}

		gl.useProgram(program)

		var sprog = new ShaderProgram(program)

		sprog.positionAttr = gl.getAttribLocation(program, "vertexPos");
		gl.enableVertexAttribArray(sprog.positionAttr)
		sprog.colorAttr = gl.getAttribLocation(program, "vertexColor");
		gl.enableVertexAttribArray(sprog.colorAttr)
		sprog.normalAttr = gl.getAttribLocation(program, "vertexNormal");
		gl.enableVertexAttribArray(sprog.normalAttr)

		return sprog
	}

	gl.u.makeFrustum = function (left, right, bottom, top, znear, zfar) {
		var X = 2*znear/(right-left)
		var Y = 2*znear/(top-bottom)
		var A = (right+left)/(right-left)
		var B = (top+bottom)/(top-bottom)
		var C = -(zfar+znear)/(zfar-znear)
		var D = -2*zfar*znear/(zfar-znear)

		return $M([[X, 0, A, 0],
							 [0, Y, B, 0],
							 [0, 0, C, D],
							 [0, 0, -1, 0]])
	}

	gl.u.makePerspective = function (fovy, aspect, znear, zfar) {
		var ymax = znear * Math.tan(fovy * Math.PI / 360.0)
		var ymin = -ymax
		var xmin = ymin * aspect
		var xmax = ymax * aspect

		return gl.u.makeFrustum(xmin, xmax, ymin, ymax, znear, zfar)
	}

	// Share and enjoy!
	return gl
}
