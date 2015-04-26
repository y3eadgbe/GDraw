var Mode = {
    DRAW   : 0,
    EDIT   : 1,
    DELETE : 2
};

var gridWidth = 20;

var svg;
var d3svg;
var graph;
var mouseX = 0, mouseY = 0;
var dragging = false;
var mousePath = []
var editMode = Mode.DRAW;
var gridMode = false;
var nodeToFront = true;

window.onload = function() {
    svg = document.getElementById("main-svg");
    d3svg = d3.select("body").select("svg");
    graph = new Graph(onGraphChanged);

    for (var i = 0; i * gridWidth < 800; i++) {
        for (var j = 0; j * gridWidth < 600; j++) {
            if ((i + j) % 2 === 1) {
                d3svg.append("rect")
                    .attr("x", i * gridWidth)
                    .attr("y", j * gridWidth)
                    .attr("width", gridWidth)
                    .attr("height", gridWidth)
                    .attr("fill", "#e0e0e0");
            }
        }
    }

    svg.addEventListener("mousedown", onSVGMouseDown, false);
    svg.addEventListener("mousemove", onSVGMouseMove, false);
    svg.addEventListener("mouseup", onSVGMouseUp, false);
    svg.addEventListener("contextmenu", function(e) { e.preventDefault();}, false);

    document.getElementById("btn-draw").addEventListener("click", function(){setEditMode(Mode.DRAW)});
    document.getElementById("btn-edit").addEventListener("click", function(){setEditMode(Mode.EDIT)});
    document.getElementById("btn-delete").addEventListener("click", function(){setEditMode(Mode.DELETE)});
    document.getElementById("btn-undo").addEventListener("click", onUndo);
    document.getElementById("btn-redo").addEventListener("click", onRedo);
    document.getElementById("btn-export-edge").addEventListener("click", onExportEdge);
    document.getElementById("btn-export-svg").addEventListener("click", onExportSVG);
    
    Module.loadModel();

    setEditMode(Mode.DRAW);
}

var onSVGMouseDown = function(e) {
    e.preventDefault();
    dragging = true;
    switch (editMode) {
    case Mode.DRAW:
        mousePath = [[mouseX, mouseY]];
        break;
    case Mode.DELETE:
        var id = getNodeIdFromPosition(mouseX, mouseY);
        if (id !== -1) {
            graph.deleteNode(id);
            graph.commit();
        }
    default:
        break;
    }
};

var onSVGMouseMove = function(e) {
    var boundingBox = svg.getBoundingClientRect();
    mouseX = e.clientX - boundingBox.left;
    mouseY = e.clientY - boundingBox.top;
    if (dragging && editMode === Mode.DRAW) {
        mousePath.push([mouseX, mouseY]);
        drawLocus();
    }
}

var onSVGMouseUp = function(e) {
    d3svg.selectAll("path").filter(".locus").remove();

    if (mousePath.length > 3 && editMode === Mode.DRAW) {
        var x = new Module.VInt();
        var y = new Module.VInt();
        for (var i = 0; i < mousePath.length; i++) {
            x.push_back(mousePath[i][0]);
            y.push_back(mousePath[i][1]);
        }

        var shape = Module.classify(x, y);
        addShape(shape);
        console.log(shape);
    }

    mousePath = [];
    dragging = false;
}

var setEditMode = function(mode) {
    editMode = mode;
    var elements = document.getElementsByClassName("edit-mode");
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.remove("active");
    }

    var activeElement;
    switch (mode) {
    case Mode.DRAW:
        activeElement = elements["btn-draw"];
        break;
    case Mode.EDIT:
        activeElement = elements["btn-edit"];
        break;
    case Mode.DELETE:
        activeElement = elements["btn-delete"];
        break;
    default:
        break;
    }
    activeElement.classList.add("active");
}

var onUndo = function() {
    graph.undo();
}

var onRedo = function() {
    graph.redo();
}

var onExportEdge = function() {
    document.getElementById("textarea").value = getEdgeListString();
}

var onExportSVG = function() {
    document.getElementById("textarea").value = getSVGString();
}

var addShape = function(shape) {
    var sid = getNodeIdFromPosition(shape.x1, shape.y1);
    var tid = getNodeIdFromPosition(shape.x2, shape.y2);
    console.log([sid, tid]);
    
    switch (shape.shape) {
    case Module.Shape.CIRCLE:
        graph.addNode(Math.round(shape.x1), Math.round(shape.y1));
        break;
    case Module.Shape.LINE:
        if (sid === -1) break;
        if (tid === -1) {
            tid = graph.addNode(shape.x2, shape.y2);
        }
        graph.addEdge(sid, tid);
        break;
    case Module.Shape.ARROW:
        if (sid === -1) break;
        if (tid === -1) {
            tid = graph.addNode(shape.x2, shape.y2);
        }
        graph.addEdge(sid, tid);
        break;
    }
    graph.commit();
}

var getNodeIdFromPosition = function(x, y) {
    var ans = -1;
    for (var i in graph.nodes) {
        var v = graph.nodes[i];
        var d = (x - v.x) * (x - v.x) + (y - v.y) * (y - v.y);
        if (d < Math.pow(v.radius + v.width / 2.0 + 3.0, 2)) ans = v.id;
    }

    return ans;
}

var getEdgeIdFromPosition = function(x, y) {
}

var drawLocus = function() {
    if (editMode !== Mode.DRAW) return;
    var locus = d3svg.selectAll("path").filter(".locus").data([mousePath]);
    locus.enter().append("path");
    locus.exit().remove();
    locus.attr("class", "locus")
        .attr("d", function(d) {
            var command = "";
            for (var i = 0; i < d.length; i++) {
                command += i ? "L " : "M ";
                command += d[i][0] + " ";
                command += d[i][1] + " ";
            }
            return command;
        })
        .attr("stroke-width", 3)
        .attr("stroke", "red")
        .attr("stroke-opacity", 0.7)
        .attr("fill", "none");
}

var onGraphChanged = function() {
    drawGraph();
    
    var undoButton = document.getElementById("btn-undo");
    var redoButton = document.getElementById("btn-redo");
    if (graph.canUndo()) {
        undoButton.classList.remove("invalid");
    } else {
        undoButton.classList.add("invalid");
    }
    if (graph.canRedo()) {
        redoButton.classList.remove("invalid");
    } else {
        redoButton.classList.add("invalid");
    }
}

var drawGraph = function() {
    var g = graph;
    
    // edges
    var edgeData = d3.entries(g.edges);
    for (var i = 0; i < edgeData.length; i++) {
        edgeData[i].kind = "edge";
    }

    var lines = d3svg.selectAll(".edges")
        .data(edgeData);
    
    lines.enter().append("line");
    lines.exit().remove();
    
    lines.attr("class", "edges")
        .attr("x1", function(d) {
            var e = d.value;
            var sv = g.nodes[e.source];
            var tv = g.nodes[e.target];
            var dx = tv.x - sv.x;
            var dy = tv.y - sv.y;
            var length = Math.max(1.0, Math.sqrt(dx * dx + dy * dy));
            return sv.x + dx / length * (sv.radius + sv.width / 2);
        })
        .attr("y1", function(d) {
            var e = d.value;
            var sv = g.nodes[e.source];
            var tv = g.nodes[e.target];
            var dx = tv.x - sv.x;
            var dy = tv.y - sv.y;
            var length = Math.max(1.0, Math.sqrt(dx * dx + dy * dy));
            return sv.y + dy / length * (sv.radius + sv.width / 2);
        })
        .attr("x2", function(d) {
            var e = d.value;
            var sv = g.nodes[e.source];
            var tv = g.nodes[e.target];
            var dx = tv.x - sv.x;
            var dy = tv.y - sv.y;
            var length = Math.max(1.0, Math.sqrt(dx * dx + dy * dy))
            return tv.x - dx / length * (tv.radius + tv.width / 2);
        })
        .attr("y2", function(d) {
            var e = d.value;
            var sv = g.nodes[e.source];
            var tv = g.nodes[e.target];
            var dx = tv.x - sv.x;
            var dy = tv.y - sv.y;
            var length = Math.max(1.0, Math.sqrt(dx * dx + dy * dy))
            return tv.y - dy / length * (tv.radius + tv.width / 2);
        })
        .attr("stroke-width", function(d) {return d.value.width;})
        .attr("stroke", "black");

    //lines.order();

    // nodes
    var nodeData = d3.entries(g.nodes);
    for (var i = 0; i < nodeData.length; i++) {
        nodeData[i].kind = "node";
    }

    var circles = d3svg.selectAll(".nodes")
        .data(nodeData);
    
    circles.enter().append("circle");
    circles.exit().remove();
    
    circles.attr("class", "nodes")
        .attr("cx", function(d) {return d.value.x;})
        .attr("cy", function(d) {return d.value.y;})
        .attr("r", function(d) {return d.value.radius;})
        .attr("stroke-width", function(d) {return d.value.width;})
        .attr("stroke", "black")
        .attr("stroke-opacity", 1)
        .attr("fill", "white")
        .attr("fill-opacity", 1)
        .call(d3.behavior.drag().on("drag", function(d) {
            if (editMode === Mode.EDIT) {
                d.value.vx += d3.event.dx;
                d.value.vy += d3.event.dy;
                if (gridMode) {
                    d.value.x = Math.round(d.value.vx / gridWidth) * gridWidth;
                    d.value.y = Math.round(d.value.vy / gridWidth) * gridWidth;
                } else {
                    d.value.x = d.value.vx;
                    d.value.y = d.value.vy;
                }
                drawGraph();
            }}).on("dragend", function(d) {
                if (editMode === Mode.EDIT) {
                    d.value.vx = d.value.x;
                    d.value.vy = d.value.y;
                    graph.setNodePosition(d.value.id, d.value.x, d.value.y);
                    graph.commit();
                }
            }));

    if (nodeToFront) {
        d3svg.selectAll(".nodes, .edges")
            .sort(function(a, b) {
                if (a.kind !== b.kind) return a.kind === "node" ? 1 : -1;
                return a.key > b.key ? 1 : -1;
            });
    }
}

var getSVGString = function() {
    var output = "";
    var elements = d3svg.selectAll(".nodes, .edges")[0];
    output += "<?xml version=\"1.0\"?>\n";
    output += "<svg xmlns=\"http://www.w3.org/2000/svg\">\n";
    for (var i = 0; i < elements.length; i++) {
        output += "  " + elements[i].outerHTML + "\n";
    }
    output += "</svg>\n";
    console.log(output);
    return output;
}

var getEdgeListString = function() {
    var edges = graph.edges;
    var directed = false;
    var normalizedId = new Object();
    var itr = 1;

    console.log(edges);
    
    for (var i in edges) {
        var e = edges[i];
        directed |= e.directed;
        if (normalizedId[e.source] === undefined) {
            normalizedId[e.source] = itr;
            itr++;
        }
        if (normalizedId[e.target] === undefined) {
            normalizedId[e.target] = itr;
            itr++;
        }
    }
    
    var output = "";
    output += "#" + (directed ? "Directed" : "Undirected") + " graph\n"
    output += "#Nodes: " + Object.keys(graph.nodes).length.toString() + "\n";
    output += "#Edges: " + Object.keys(graph.edges).length.toString() + "\n";
    for (var i in edges) {
        var e = edges[i];
        var u = normalizedId[e.source], v = normalizedId[e.target];
        if (!directed) {
            if (v < u) v = [u, u = v][0];
            output += u.toString() + " " + v.toString() + "\n";
        } else {
            output += u.toString() + " " + v.toString() + "\n";
            if (!e.directed) {
                output += v.toString() + " " + u.toString() + "\n";
            }
        }
    }
    return output;
}


//main();