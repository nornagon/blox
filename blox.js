function setFps(fps) {
	document.getElementById('framerate').innerHTML = fps.toFixed(2)
}

var Frame = (function (cb) {
	var lastFrame, frames = 0;
	return function () {
		var now = Date.now()
		if (!lastFrame) { lastFrame = now }
		frames++
		if (now - lastFrame > 1000) {
			cb(frames/(now - lastFrame)*1000)
			lastFrame = now
			frames = 0
		}
	}
})(setFps)

function main() {
	var canvas = document.getElementById('blox')
	var gl = glu(canvas)
	if (!gl) {
		canvas.parentNode.innerHTML = "Couldn't initialize webgl :("
		return
	}

	var program = gl.u.createProgram("vertex","fragment")
	if (program === undefined) {
		console.log("Exiting.")
		return
	}

	canvas.width = Math.floor(window.innerWidth)
	canvas.height = Math.floor(window.innerHeight * 0.9)
	gl.viewport(0, 0, canvas.width, canvas.height)

	gl.clearColor(0,0,0,1)
	gl.enable(gl.CULL_FACE)
	gl.enable(gl.DEPTH_TEST)

	// var LEFT = 0, RIGHT = 1, BOTTOM = 2, TOP = 3, BACK = 4, FRONT = 5
	var normalX = [-1, 1, 0, 0, 0, 0]
	var normalY = [0, 0, -1, 1, 0, 0]
	var normalZ = [0, 0, 0, 0, -1, 1]
	var chunkVertPos = []
	var chunkVertNormal = []
	for (var f = 0; f < 6; f++) {
		for (var y = 0; y < 16; y++) {
			for (var x = 0; x < 16; x++) {
				for (var z = 0; z < 16; z++) {
					var v = f*16*16*16+y*16*16+x*16+z
					chunkVertPos[3*v] = x
					chunkVertPos[3*v+1] = y
					chunkVertPos[3*v+2] = z
					chunkVertNormal[3*v] = normalX[f]
					chunkVertNormal[3*v+1] = normalY[f]
					chunkVertNormal[3*v+2] = normalZ[f]
				}
			}
		}
	}
	var chunkPosBuf = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, chunkPosBuf)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(chunkVertPos), gl.STATIC_DRAW)

	var chunkNormalBuf = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, chunkNormalBuf)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(chunkVertNormal), gl.STATIC_DRAW)

	var chunkVertColor = []
	for (var f = 0; f < 6; f++) {
		for (var y = 0; y < 16; y++) {
			for (var x = 0; x < 16; x++) {
				for (var z = 0; z < 16; z++) {
					var v = f*16*16*16+y*16*16+x*16+z
					chunkVertColor[4*v] = Math.min(x/16, 1)
					chunkVertColor[4*v+1] = Math.min(y/16, 1)
					chunkVertColor[4*v+2] = Math.min(z/16, 1)
					chunkVertColor[4*v+3] = 1
				}
			}
		}
	}

	var colorBuf = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(chunkVertColor), gl.STATIC_DRAW)


	/*
     y+
     |
     |
		 |
		 o---- x+
    /
   /
  z+ (out of screen)

	*/

	var cubeIdcs = [
		[0,0,0], [0,1,1], [0,1,0], // yz, x=0 LEFT
		[0,0,0], [0,0,1], [0,1,1],
		[1,1,1], [1,0,0], [1,1,0], // yz, x=1 RIGHT
		[1,1,1], [1,0,1], [1,0,0],
		[0,0,0], [1,0,1], [0,0,1], // xz, y=0 BOTTOM
		[0,0,0], [1,0,0], [1,0,1],
		[1,1,1], [0,1,0], [0,1,1], // xz, y=1 TOP
		[1,1,1], [1,1,0], [0,1,0],
		[0,0,0], [1,1,0], [1,0,0], // xy, z=0 BACK
		[0,0,0], [0,1,0], [1,1,0],
		[1,1,1], [0,0,1], [1,0,1], // xy, z=1 FRONT
		[1,1,1], [0,1,1], [0,0,1],
	]

	function Chunk(x,y,z) {
		this.x = x; this.y = y; this.z = z
		this.mat = Matrix.Translation(x*16,y*16,z*16)
		this.posBuffer = chunkPosBuf
		this.normalBuffer = chunkNormalBuf
		this.indexBuffer = gl.createBuffer()
		this.blocks = new Uint16Array(16*16*16)
		this.numElems = 0
	}
	Chunk.prototype.rebuild = function () {
		var elements = []
		for (var y = 0; y < 16; y++) {
			for (var x = 0; x < 16; x++) {
				for (var z = 0; z < 16; z++) {
					var v = y*16*16+x*16+z
					if (this.blocks[v]) {
						// if this block is not air
						for (var f = 0; f < 6; f++) {
							// for each of its faces
							var nx = normalX[f], ny = normalY[f], nz = normalZ[f]
							if (x+nx < 0 || x+nx > 15 ||
									y+ny < 0 || y+ny > 15 ||
									z+nz < 0 || z+nz > 15 ||
									this.blocks[(y+ny)*16*16+(x+nx)*16+z+nz] == 0) {
								// if the block next to it is air
								// fill in that face (6 vertices per face)
								for (var i = 0; i < 6; i++) {
									var dp = cubeIdcs[f*6+i]
									elements.push(f*16*16*16+(y+dp[1])*16*16+(x+dp[0])*16+(z+dp[2]))
								}
							}
						}
					}
				}
			}
		}
		this.numElems = elements.length
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(elements), gl.STATIC_DRAW)
	}
	Chunk.prototype.block = function (x,y,z, v) {
		var l = y*16*16+x*16+z
		if (typeof v !== 'undefined') {
			this.blocks[l] = v
			return v
		}
		return this.blocks[l]
	}

	var chunk = new Chunk(0,0,0)
	for (var y = 0; y < 16; y++) {
		for (var x = 0; x < 16; x++) {
			for (var z = 0; z < 16; z++) {
				var dx = (x-4), dy = (y-4), dz = (z-4)
				if (dx*dx+dy*dy+dz*dz <= 16) {
					chunk.block(x,y,z, 1)
				} else {
					chunk.block(x,y,z, 0)
				}
			}
		}
	}
	chunk.rebuild()

	var proj = gl.u.makePerspective(60, canvas.width/canvas.height, 0.1, 100)
	var mv = Matrix.I(4)

	function rotY(t) {
		var c = Math.cos(t), s = Math.sin(t)
		return $M([
			[ c, 0, s, 0 ],
			[ 0, 1, 0, 0 ],
			[ -s, 0, c, 0 ],
			[ 0, 0, 0, 1 ],
		])
	}

	var lastFrame = null
	function drawScene() {
		if (lastFrame == null) {
			lastFrame = Date.now()
		}
		var now = Date.now()
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

		mv = Matrix.I(4)
		mv.elements[1][3] = -6
		mv.elements[2][3] = -20
		mv = mv.x(rotY((now - lastFrame) / 1000))

		program.uniform("projection", proj)
		program.uniform("modelView", mv)
		program.uniform("normalMatrix", mv.minor(1,1,3,3).inverse().transpose())
		var o = 1/Math.sqrt(3)
		program.uniform("lightDir", [o,o,o])
		program.uniform("lightColor", [1,1,1])
		program.uniform("ambientColor", [0.3,0.3,0.2])

		gl.bindBuffer(gl.ARRAY_BUFFER, chunk.posBuffer)
		gl.vertexAttribPointer(program.positionAttr, 3, gl.FLOAT, false, 0, 0)
		gl.bindBuffer(gl.ARRAY_BUFFER, chunk.normalBuffer)
		gl.vertexAttribPointer(program.normalAttr, 3, gl.FLOAT, false, 0, 0)
		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
		gl.vertexAttribPointer(program.colorAttr, 4, gl.FLOAT, false, 0, 0)
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, chunk.indexBuffer)
		gl.drawElements(gl.TRIANGLES, chunk.numElems, gl.UNSIGNED_SHORT, 0)
	}

	var running = true
	var stop = false

	function tick() {
		if (stop) { running = false; return }
		drawScene()
		Frame()
		window.requestAnimFrame(tick, canvas)
	}

	window.onblur = function () { stop = true }
	window.onfocus = function () {
		stop = false
		if (!running) { tick() }
	}

	canvas.onmousedown = function (e) {
		// translate x/y coords into normalised [-1,1] screen coords
		var ww = canvas.width
		var wh = canvas.height
		var window_x = e.clientX - ww/2
		var window_y = (wh - e.clientY) - wh/2
		var norm_x = 2 * window_x / ww
		var norm_y = 2 * window_y / wh

		// screen coordinate s, world coordinate w, ' = inverse
		// s = P M w
		// so w = M' P' P M w = M' P' s = (P M)' s
		var unview = proj.x(mv).inverse()
		var near_point = unview.x($V([norm_x, norm_y, 0, 1]))
		near_point = near_point.x(1/near_point.elements[3])

		var cam_pos = mv.inverse().col(4)
		var ray_dir = near_point.subtract(cam_pos).toUnitVector()
		// cast ray from cam_pos in direction of ray_dir.
		var origin = {
			x: cam_pos.elements[0],
			y: cam_pos.elements[1],
			z: cam_pos.elements[2],
		}
		var ray = {
			x: ray_dir.elements[0],
			y: ray_dir.elements[1],
			z: ray_dir.elements[2],
		}

		var cx = Math.floor(origin.x)
		var cy = Math.floor(origin.y)
		var cz = Math.floor(origin.z)

		var stepX = ray.x > 0 ? 1 : -1
		var stepY = ray.y > 0 ? 1 : -1
		var stepZ = ray.z > 0 ? 1 : -1
		var nextX = stepX > 0 ? cx+1 : cx
		var nextY = stepY > 0 ? cy+1 : cy
		var nextZ = stepZ > 0 ? cz+1 : cz
		var tMaxX = (nextX-origin.x) / ray.x
		var tMaxY = (nextY-origin.y) / ray.y
		var tMaxZ = (nextZ-origin.z) / ray.z
		var tDeltaX = Math.abs(1/ray.x)
		var tDeltaY = Math.abs(1/ray.y)
		var tDeltaZ = Math.abs(1/ray.z)

		for (var i = 0; i < 1000; i++) {
			if (cx >= 0 && cy >= 0 && cz >= 0 && cx < 16 && cy < 16 && cz < 16) {
				if (chunk.block(cx,cy,cz)) { break }
			}
			if (tMaxX < tMaxY) {
				if (tMaxX < tMaxZ) {
					cx += stepX
					tMaxX += tDeltaX
				} else {
					cz += stepZ
					tMaxZ += tDeltaZ
				}
			} else {
				if (tMaxY < tMaxZ) {
					cy += stepY
					tMaxY += tDeltaY
				} else {
					cz += stepZ
					tMaxZ += tDeltaZ
				}
			}
		}
		if (i < 1000) {
			console.log(cx, cy, cz)
			chunk.block(cx,cy,cz, 0)
			chunk.rebuild()
		}
	}
	document.onmousemove = function (e) {
	}
	document.onmouseup = function (e) {
	}
	tick()
}

// ugh, browsers
window.requestAnimFrame = (function () {
	return window.requestAnimationFrame ||
	       window.webkitRequestAnimationFrame ||
	       window.mozRequestAnimationFrame ||
	       window.oRequestAnimationFrame ||
	       window.msRequestAnimationFrame ||
	       function(callback, element) {
	         window.setTimeout(callback, 1000/60)
	       }
})()

main()
