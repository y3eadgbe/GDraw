var Mode = {
    DRAW   : 0,
    EDIT   : 1,
    DELETE : 2,
    LAYOUT : 3
};

var ObjectType = {
    NONE   : 0,
    VERTEX : 1,
    EDGE   : 2
};

var GraphObject = function(type, id) {
    this.type = type;
    this.id = id;
};

var gridWidth = 20;

var canvasWidth = 800, canvasHeight = 600;
var svg;
var d3svg;
var graph;
var mouseX = 0, mouseY = 0;
var dragging = false;
var rangeSelectMode = false;
var dragStartX, dragStartY;
var movedAfterMouseDown = false;
var mousePath = [];
var editMode = Mode.EDIT;
var gridMode = false;
var nodeToFront = true;
var selectedNodes = [];
var nodeClicked = -1;
var clickedWithShift = false;
var layoutTimer;
var layoutVx = [], layoutVy = [];
var layoutCvx, layoutCvy;

var defaultNodeSize = 20;

var main = function() {
    svg = $("#main-svg");
    d3svg = d3.select("body").select("svg");
    graph = new Graph(onGraphChanged);
    $("#node-size").slider({
        min: 10,
        max: 40,
        step: 1,
        value: defaultNodeSize,
        slide: onSlideNodeSize,
        change: onChangeNodeSize
    });

    // draw grid
    for (var i = 0; i * gridWidth < canvasWidth; i++) {
        for (var j = 0; j * gridWidth < canvasHeight; j++) {
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

    // event handlers
    svg.mousedown(onSVGMouseDown);
    svg.mousemove(onSVGMouseMove);
    svg.mouseup(onSVGMouseUp);
    svg.bind("contextmenu", function(e) { e.preventDefault();});
    svg.bind("touchstart", onSVGMouseDown);
    svg.bind("touchmove", onSVGMouseMove); 
    svg.bind("touchend", onSVGMouseUp); 

    $("#btn-draw").click(function(){setEditMode(Mode.DRAW);});
    $("#btn-edit").click(function(){setEditMode(Mode.EDIT);});
    $("#btn-delete").click(function(){setEditMode(Mode.DELETE);});
    $("#btn-layout").click(function(){setEditMode(Mode.LAYOUT);});
    $("#btn-undo").click(onUndo);
    $("#btn-redo").click(onRedo);
    $("#btn-export-edge").click(onExportEdge);
    $("#btn-export-svg").click(onExportSVG);
    $("#btn-export-json").click(onExportJSON);
    $("#btn-import-json").click(onImportJSON);
    $("#node-color").change(onChangeNodeColor);
    $("#node-stroke-color").change(onChangeNodeStrokeColor);
    $("#node-mine").change(onChangeNodeMine);

    // shortcuts
    shortcut.add("Ctrl+Z", onUndo, {"disable_in_input": true});
    shortcut.add("Ctrl+Y", onRedo, {"disable_in_input": true});
    shortcut.add("Ctrl+A", selectAllNodes, {"disable_in_input": true});
    shortcut.add("G", toggleGridMode, {"disable_in_input": true});
    shortcut.add("Z", function(){setEditMode(Mode.DRAW);}, {"disable_in_input": true});
    shortcut.add("X", function(){setEditMode(Mode.EDIT);}, {"disable_in_input": true});
    shortcut.add("C", function(){setEditMode(Mode.DELETE);}, {"disable_in_input": true});
    shortcut.add("F", function(){setEditMode(Mode.LAYOUT);}, {"disable_in_input": true});
    
    Module.loadModel();

    setEditMode(Mode.DRAW);
};

var modifySelectedNodesOnMouseDown = function(id, shift) {
    if (id === -1) {
        rangeSelectMode = true;
        if (!shift) {
            clearSelectedNodes();
        }
    } else {
        var pos = selectedNodes.indexOf(id);
        nodeClicked = id;
        if (shift) {
            clickedWithShift = true;
            if (pos === -1) {
                selectedNodes.push(id);
                nodeClicked = -1;
            }
        } else {
            clickedWithShift = false;
            if (pos === -1) {
                selectedNodes = [id];
                nodeClicked = -1;
            }
        }
        drawSelectedNodes();
        updateNodePanel();
    }
};

var modifySelectedNodesOnMouseUp = function() {
    if (movedAfterMouseDown) {
        if (rangeSelectMode) {
            var ul = [Math.min(dragStartX, mouseX), Math.min(dragStartY, mouseY)];
            var lr = [Math.max(dragStartX, mouseX), Math.max(dragStartY, mouseY)];
            for (var i in graph.nodes) {
                var v = graph.nodes[i]
                var c = [v.x, v.y];
                var r = v.radius + v.width / 2.0;
                var index = parseInt(i);
                if (intersectRectCircle(ul, lr, c, r)) {
                    var pos = selectedNodes.indexOf(index);
                    if (pos === -1) {
                        selectedNodes.push(index);
                    }
                }
            }
        }
    } else if (nodeClicked !== -1) {
        if (clickedWithShift) {
            var pos = selectedNodes.indexOf(nodeClicked);
            selectedNodes.splice(pos, 1);
        } else {
            selectedNodes = [nodeClicked];
        }
    }
    nodeClicked = -1;
    rangeSelectMode = false;
    drawSelectedNodes();
    updateNodePanel();
}

var updateNodePanel = function() {
    var id = -1;
    if (selectedNodes.length > 0) {
        id = selectedNodes[selectedNodes.length - 1];
    }
    if (id !== -1) {
        $('#node-id').text(id);
        $('#node-color').val(graph.getNodeColor(id));
        $('#node-stroke-color').val(graph.getNodeStrokeColor(id));
        $('#node-size').slider("value", graph.getNodeRadius(id));
	$('#node-mine')[0].checked = graph.getNodeMine(id);
    }
}

var clearSelectedNodes = function() {
    selectedNodes = [];
    drawSelectedNodes();
};

var forceLayout = function() {
    var cx = 0.0, cy = 0.0;
    var coulombC = 25000;
    var hookC = 0.1;
    var naturalLength = 40;
    var delta = 0.2;
    var decay = 0.95;
    var cameraSpeed = 0.2;
    var cameraDecay = 0.85;

    for (var i in graph.nodes) {
        var Fx = 0.0, Fy = 0.0;
        var u = graph.nodes[i];
        for (var j in graph.nodes) {
            if (i === j) continue;
            var v = graph.nodes[j];
            var vecx = u.x - v.x;
            var vecy = u.y - v.y;
            var dsquare = Math.pow(vecx, 2) + Math.pow(vecy, 2);
            dsquare = Math.max(4, dsquare);
            var F = coulombC / dsquare;
            Fx += F * vecx / Math.sqrt(dsquare);
            Fy += F * vecy / Math.sqrt(dsquare);
        }
        
        var neighbors = Object.keys(graph.adjacencyList[i]);

        for (var j = 0; j < neighbors.length; j++) {
            var v = graph.nodes[neighbors[j]];
            var vecx = v.x - u.x;
            var vecy = v.y - u.y;
            var d = Math.sqrt(Math.pow(vecx, 2) + Math.pow(vecy, 2));
            d = Math.max(2, d);
            Fx += hookC * vecx * (d - naturalLength) / d;
            Fy += hookC * vecy * (d - naturalLength) / d;
        }

        layoutVx[i] += Fx * delta;
        layoutVy[i] += Fy * delta;
        layoutVx[i] *= decay;
        layoutVy[i] *= decay;
        u.x += layoutVx[i] * delta;
        u.y += layoutVy[i] * delta;
        cx += u.x;
        cy += u.y;
    }
    cx /= Object.keys(graph.nodes).length;
    cy /= Object.keys(graph.nodes).length;
    layoutCvx += (cx - (canvasWidth / 2.0)) * delta * cameraSpeed;
    layoutCvy += (cy - (canvasHeight / 2.0)) * delta * cameraSpeed;
    layoutCvx *= cameraDecay;
    layoutCvy *= cameraDecay;

    for (var i in graph.nodes) {
        graph.nodes[i].x -= layoutCvx * delta;
        graph.nodes[i].y -= layoutCvy * delta;
    }

    drawGraph();
}

var selectAllNodes = function() {
    if (editMode !== Mode.EDIT) return;
    selectedNodes = []
    for (var i in graph.nodes) {
        selectedNodes.push(parseInt(i));
    }
    drawSelectedNodes();
    updateNodePanel();
}

var onSVGMouseDown = function(e) {
    e.preventDefault();
    dragging = true;
    dragStartX = mouseX;
    dragStartY = mouseY;
    movedAfterMouseDown = false;

    var obj = getObjectFromPosition(mouseX, mouseY);

    switch (editMode) {
    case Mode.DRAW:
        mousePath = [[mouseX, mouseY]];
        break;
    case Mode.EDIT:
        if (obj.type === ObjectType.VERTEX) {
            modifySelectedNodesOnMouseDown(obj.id, e.shiftKey);
        } else {
            modifySelectedNodesOnMouseDown(-1, e.shiftKey);
        }
        break;
    case Mode.DELETE:
        switch (obj.type) {
        case ObjectType.VERTEX:
            graph.deleteNode(obj.id);
            graph.commit();
            break;
        case ObjectType.EDGE:
            graph.deleteEdge(obj.id);
            graph.commit();
            break;
        }
        break;
    }    
};

var onSVGMouseMove = function(e) {
    movedAfterMouseDown = true;
    var boundingBox = svg[0].getBoundingClientRect();
    var dx = e.clientX - boundingBox.left - mouseX;
    var dy = e.clientY - boundingBox.top - mouseY;
    mouseX = e.clientX - boundingBox.left;
    mouseY = e.clientY - boundingBox.top;
    if (dragging && editMode === Mode.DRAW) {
        mousePath.push([mouseX, mouseY]);
        drawLocus();
    }
    if (dragging && editMode === Mode.EDIT) {
        if (rangeSelectMode) {
            drawRange();
        } else {
            for (var i = 0; i < selectedNodes.length; i++) {
                var node = graph.nodes[selectedNodes[i]];
                node.vx += dx;
                node.vy += dy;
                if (gridMode) {
                    node.x = Math.round(node.vx / gridWidth) * gridWidth;
                    node.y = Math.round(node.vy / gridWidth) * gridWidth;
                } else {
                    node.x = node.vx;
                    node.y = node.vy;
                }
                drawGraph();
            }
        }
    }
};

var onSVGMouseUp = function(e) {
    d3svg.selectAll("path").filter(".locus").remove();
    d3svg.selectAll("rect").filter(".range").remove();

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
    if (movedAfterMouseDown && editMode === Mode.EDIT) {
        for (var i = 0; i < selectedNodes.length; i++) {
            var node = graph.nodes[selectedNodes[i]];
            node.vx = node.x;
            node.vy = node.y;
            graph.setNodePosition(selectedNodes[i], node.x, node.y);
        }
        graph.commit();
    }

    dragging = false;
    if (editMode === Mode.EDIT) {
        modifySelectedNodesOnMouseUp(movedAfterMouseDown);
    }
};

var setEditMode = function(mode) {
    if (editMode === mode) return;
    d3svg.selectAll("path").filter(".locus").remove();
    d3svg.selectAll("rect").filter(".range").remove();

    if (editMode === Mode.LAYOUT) {
        clearInterval(layoutTimer);
        for (var i in graph.nodes) {
            var node = graph.nodes[i];
            node.vx = node.x;
            node.vy = node.y;
            graph.setNodePosition(i, node.x, node.y);
        }
        graph.commit();
    }
    editMode = mode;
    $(".edit-mode").removeClass("active");

    var activeElement;
    switch (mode) {
    case Mode.DRAW:
        activeElement = $("#btn-draw");
        clearSelectedNodes();
        break;
    case Mode.EDIT:
        activeElement = $("#btn-edit");
        break;
    case Mode.DELETE:
        activeElement = $("#btn-delete");
        clearSelectedNodes();
        break;
    case Mode.LAYOUT:
        activeElement = $("#btn-layout");
        clearSelectedNodes();
        layoutVx = new Object();
        layoutVy = new Object();
        for (var i in graph.nodes) {
            layoutVx[i] = 0.0;
            layoutVy[i] = 0.0;
        }
        layoutCvx = 0.0;
        layoutCvy = 0.0;
        layoutTimer = setInterval(forceLayout, 16);
    default:
        break;
    }
    activeElement.addClass("active");
    updateNodePanel();
};

var onUndo = function() {
    if (editMode === Mode.LAYOUT) return;
    clearSelectedNodes();
    graph.undo();
};

var onRedo = function() {
    if (editMode === Mode.LAYOUT) return;
    clearSelectedNodes();
    graph.redo();
};

var onExportEdge = function() {
    downloadText("out.txt", getEdgeListString());
};

var onExportSVG = function() {
    downloadText("out.svg", getSVGString());
};

var onExportJSON = function() {
    downloadText("out.json", getJSONString());
};

var onImportJSON = function() {
    var JSONobj = JSON.parse($("#textarea").val());

    graph.nodes = JSONobj.nodes;
    graph.edges = JSONobj.edges;
    graph.adjacencyList = JSONobj.adjacencyList;
    graph.nodeItr = JSONobj.nodeItr;
    graph.edgeItr = JSONobj.edgeItr;
    graph.undoStack = [];
    graph.redoStack = [];
    graph.changeList = [];
    selectedNodes = [];

    for (var i in graph.nodes) {
        graph.nodes[i].__proto__ = GraphNode.prototype;
    }

    for (var i in graph.edges) {
        graph.edges[i].__proto__ = GraphEdge.prototype;
    }
    drawGraph();
};

var onSlideNodeSize = function(e, ui) {
    for (var i = 0; i < selectedNodes.length; ++i) {
        graph.setNodeRadius(selectedNodes[i], ui.value);
    }
}

var onChangeNodeSize = function(e, ui) {
    if (e.originalEvent) {
        for (var i = 0; i < selectedNodes.length; ++i) {
            graph.setNodeRadius(selectedNodes[i], ui.value);
        }
        
        if (selectedNodes.length > 0) {
            graph.commit();
        }
    }
}

var onChangeNodeColor = function() {
    for (var i = 0; i < selectedNodes.length; ++i) {
        graph.setNodeColor(selectedNodes[i], $("#node-color").val());
    }
    
    if (selectedNodes.length > 0) {
        graph.commit();
    }
};

var onChangeNodeStrokeColor = function() {
    for (var i = 0; i < selectedNodes.length; ++i) {
        graph.setNodeStrokeColor(selectedNodes[i], $("#node-stroke-color").val());
    }
    
    if (selectedNodes.length > 0) {
        graph.commit();
    }
};

var onChangeNodeMine = function() {
    for (var i = 0; i < selectedNodes.length; ++i) {
	console.log(i)
	console.log($("#node-mine")[0].checked)
	graph.setNodeMine(selectedNodes[i], $("#node-mine")[0].checked);
    }

    if (selectedNodes.length > 0) {
	graph.commit();
    }
}

var toggleGridMode = function(){
    gridMode = !gridMode;
};

var addShape = function(shape) {
    var sid = getNodeIdFromPosition(shape.x1, shape.y1);
    var tid = getNodeIdFromPosition(shape.x2, shape.y2);
    
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
};

var getObjectFromPosition = function(x, y) {
    var obj = new GraphObject(ObjectType.NONE, -1);
    var id = getNodeIdFromPosition(x, y);
    if (id !== -1) {
        obj.type = ObjectType.VERTEX;
        obj.id = id;
        return obj;
    }

    id = getEdgeIdFromPosition(x, y);
    if (id !== -1) {
        obj.type = ObjectType.EDGE;
        obj.id = id;
        return obj;
    }

    return obj;
}

var getNodeIdFromPosition = function(x, y) {
    var ans = -1;
    for (var i in graph.nodes) {
        var v = graph.nodes[i];
        var d = (x - v.x) * (x - v.x) + (y - v.y) * (y - v.y);
        if (d < Math.pow(v.radius + v.width / 2.0 + 3.0, 2)) ans = v.id;
    }

    return ans;
};

var getEdgeIdFromPosition = function(x, y) {
    var ans = -1;
    for (var i in graph.edges) {
        var e = graph.edges[i];
        var sv = graph.nodes[e.source];
        var tv = graph.nodes[e.target];
        var dx = tv.x - sv.x;
        var dy = tv.y - sv.y;
        var length = Math.max(1.0, Math.sqrt(dx * dx + dy * dy));
        var x1 = sv.x + dx / length * (sv.radius + sv.width / 2);
        var y1 = sv.y + dy / length * (sv.radius + sv.width / 2);
        var x2 = tv.x - dx / length * (sv.radius + sv.width / 2);
        var y2 = tv.y - dy / length * (sv.radius + sv.width / 2);
        var d = distanceSP([x1, y1], [x2, y2], [x, y]);
        if (d < e.width / 2 + 5.0) ans = e.id;
    }
    return ans;
};

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
};

var drawRange = function() {
    if (editMode !== Mode.EDIT) return;
    var range = d3svg.selectAll("rect").filter(".range").data([[dragStartX, dragStartY, mouseX, mouseY]]);
    range.enter().append("rect");
    range.exit().remove();
    range.attr("class", "range")
        .attr("x", function(d) { return Math.min(d[0], d[2]); })
        .attr("y", function(d) { return Math.min(d[1], d[3]); })
        .attr("width", function(d) { return Math.abs(d[2] - d[0]); })
        .attr("height", function(d) { return Math.abs(d[3] - d[1]); })
        .attr("fill", "royalblue")
        .attr("fill-opacity", 0.5);
}

var drawSelectedNodes = function() {
    var selected = d3svg.selectAll("circle").filter(".selected-nodes").data(selectedNodes.map(function(x) {return graph.nodes[x];}));
    selected.enter().append("circle");
    selected.exit().remove();
    selected.attr("class", "selected-nodes")
        .attr("cx", function(d) {return d.x;})
        .attr("cy", function(d) {return d.y;})
        .attr("r", function(d) {
            return d.radius + d.width / 2.0 + 2.0;
        })
        .attr("stroke-width", 4)
        .attr("stroke", "royalblue")
        .attr("stroke-opacity", 0.5)
        .attr("fill", "none")
        .attr("pointer-events", "none");
};

var onGraphChanged = function() {
    drawGraph();
    
    if (graph.canUndo()) {
        $("#btn-undo").removeClass("invalid");
    } else {
        $("#btn-undo").addClass("invalid");
    }
    if (graph.canRedo()) {
        $("#btn-redo").removeClass("invalid");
    } else {
        $("#btn-redo").addClass("invalid");
    }
};

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
    
    var getXY = function(sourceid, targetid){
        var sv = g.nodes[sourceid];
        var tv = g.nodes[targetid];
        var dx = tv.x - sv.x;
        var dy = tv.y - sv.y;
        var scale = (sv.radius + sv.width / 2) / Math.max(1.0, Math.sqrt(dx * dx + dy * dy));
        return {v : sv, x : dx * scale, y : dy * scale};
    };

    lines.attr({
        "class" : "edges",
        "x1" : function(d) {
            var  t =  getXY(d.value.source, d.value.target);
            return t.v.x + t.x;
        },
        "y1" : function(d) {
            var  t =  getXY(d.value.source, d.value.target);
            return t.v.y + t.y;
        },
        "x2" : function(d) {
            var  t =  getXY(d.value.target, d.value.source);
            return t.v.x + t.x;
        },
        "y2" : function(d) {
            var  t =  getXY(d.value.target, d.value.source);
            return t.v.y + t.y;
        },
        "stroke-width" : function(d) {return d.value.width;},
        "stroke" : "black"
    });
    
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
        .attr("stroke", function(d){return d.value.strokeColor;})
        .attr("stroke-opacity", 1)
        .attr("fill", function(d){return d.value.color;})
        .attr("fill-opacity", 1);
        
    if (nodeToFront) {
        d3svg.selectAll(".nodes, .edges")
            .sort(function(a, b) {
                if (a.kind !== b.kind) return a.kind === "node" ? 1 : -1;
                return a.key > b.key ? 1 : -1;
            });
    }

    drawSelectedNodes();
};

var getSVGString = function() {
    var output = "";
    var elements = d3svg.selectAll(".nodes, .edges")[0];
    output += "<?xml version=\"1.0\"?>\n";
    output += "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 800 600\">\n";
    for (var i = 0; i < elements.length; i++) {
        output += "  " + elements[i].outerHTML + "\n";
    }
    output += "</svg>\n";
    return output;
};

var getJSONString = function() {
    var JSONobj = {
        nodes : graph.nodes,
        edges : graph.edges,
        adjacencyList : graph.adjacencyList,
        nodeItr : graph.nodeItr,
        edgeItr : graph.edgeItr
    };

    return JSON.stringify(JSONobj);
};

var getEdgeListString = function() {
    var edges = graph.edges;
    var directed = false;
    var normalizedId = new Object();
    var itr = 1;

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
    output += "#" + (directed ? "Directed" : "Undirected") + " graph\n";
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
};

window.onload = main;

//main();
