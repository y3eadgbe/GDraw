(function(win) {

//-- interface
var Graph = function(onChanged) {
    this.onChanged = onChanged;
    this.nodes = new Object();
    this.edges = new Object();
    this.adjacencyList = new Object();
    this.nodeItr = 0;
    this.edgeItr = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.changeList = [];
}

Graph.prototype = {
// public
    constructor:     Graph,                // Graph(onChanged)
    addNode:         GraphAddNode,         // addNode(x, y, radius, width)
    deleteNode:      GraphDeleteNode,      // deleteNode(id)
    setNodePosition: GraphSetNodePosition, // setNodePosition(x, y)
    setNodeRadius:   GraphSetNodeRadius,   // setNodeRadius(id, radius)
    setNodeWidth:    GraphSetNodeWidth,    // setNodeWidth(id, width)
    addEdge:         GraphAddEdge,         // addEdge(source, target, directed, width)
    deleteEdge:      GraphDeleteEdge,      // deleteEdge(id)
    setEdgeWidth:    GraphSetEdgeWidth,    // setEdgeWidth(id, width)
    commit:          GraphCommit,          // commit()
    undo:            GraphUndo,            // undo()
    redo:            GraphRedo,            // redo()
    canUndo:         GraphCanUndo,         // canUndo()
    canRedo:         GraphCanRedo,         // canRedo()

//private
    _addPatch:       GraphAddPatch,        // addPatch(patch)
    _undoPatch:      GraphUndoPatch,       // undoPatch(patch)
    _redoPatch:      GraphRedoPatch        // redoPatch(patch)
};

//-- implementation

var Node = function(id, x, y, radius, width) {
    this.id = id;
    this.x = x === undefined ? 0 : x;
    this.y = y === undefined ? 0 : y;
    this.vx = this.x;
    this.vy = this.y;
    this.prevx = this.x;
    this.prevy = this.y;
    this.radius = radius === undefined ? 20 : radius;
    this.width = width === undefined ? 2 : width

    this.copy = function() {
        var newObject = new Node(this.id, this.prevx, this.prevy, this.radius, this.width);
        return newObject;
    }
}

var Edge = function(id, source, target, directed, width) {
    this.id = id;
    this.source = source;
    this.target = target;
    this.directed = directed;
    this.width = width === undefined ? 2 : width;

    this.copy = function() {
        var newObject = new Edge(this.id, this.source, this.target, this.directed, this.width);
        return newObject;
    }
}

var UpdateType = {
    NODE_ADDITION  : 0,
    NODE_DELETION  : 1,
    NODE_ATTRIBUTE : 2,
    EDGE_ADDITION  : 3,
    EDGE_DELETION  : 4,
    EDGE_ATTRIBUTE : 5
};

var Patch = function(type, before, after) {
    this.type = type;
    this.before = before;
    this.after = after;
}

function GraphAddNode(x, y, radius, width) {
    var patch = new Patch(UpdateType.NODE_ADDITION, undefined, undefined);
    this.nodes[this.nodeItr] = new Node(this.nodeItr, x, y, radius, width);
    this.adjacencyList[this.nodeItr] = new Object();
    patch.after = this.nodes[this.nodeItr].copy();
    
    this._addPatch(patch);
    this.onChanged();
    return this.nodeItr++;
}

function GraphSetNodePosition(id, x, y) {
    var patch = new Patch(UpdateType.NODE_ATTRIBUTE, this.nodes[id].copy(), undefined);
    console.log([id, x, y]);
    this.nodes[id].x = x;
    this.nodes[id].y = y;
    this.nodes[id].vx = x;
    this.nodes[id].vy = y;
    this.nodes[id].prevx = x;
    this.nodes[id].prevy = y;
    patch.after = this.nodes[id].copy();

    this._addPatch(patch);
    this.onChanged();
}

function GraphSetNodeRadius(id, radius) {
    var patch = new Patch(UpdateType.NODE_ATTRIBUTE, this.nodes[id].copy(), undefined);
    this.nodes[id].radius = radius;
    patch.after = this.nodes[id].copy();

    this._addPatch(patch);
    this.onChanged();
}

function GraphSetNodeWidth(id, width) {
    var patch = new Patch(UpdateType.NODE_ATTRIBUTE, this.nodes[id].copy(), undefined);
    this.nodes[id].width = width;
    patch.after = this.nodes[id].copy();

    this._addPatch(patch);
    this.onChanged();
}

function GraphDeleteNode(id) {
    var v = this.nodes[id];
    if (v === undefined) return;
    var patch = new Patch(UpdateType.NODE_DELETION, v.copy(), undefined);
    
    for (var i in this.edges) {
        var e = this.edges[i];
        if (e.source == id || e.target == id) this.deleteEdge(i, true);
    }
    
    delete this.nodes[id];
    delete this.adjacencyList[id];

    this._addPatch(patch);
    this.onChanged();
}

function GraphAddEdge(source, target, directed, width) {
    if (this.nodes[source] === undefined || this.nodes[target] === undefined) return;
    directed = directed === undefined ? false : directed;
    
    if (directed) {
        if (this.adjacencyList[source][target] !== undefined) return;
        this.adjacencyList[source][target] = true;
    } else {
        if (this.adjacencyList[source][target] !== undefined) return;
        if (this.adjacencyList[target][source] !== undefined) return;
        this.adjacencyList[source][target] = true;
        this.adjacencyList[target][source] = true;
    }
    
    this.edges[this.edgeItr] = new Edge(this.edgeItr, source, target, directed, width);
    var patch = new Patch(UpdateType.EDGE_ADDITION, undefined, this.edges[this.edgeItr].copy());
    
    this._addPatch(patch);
    this.onChanged();
    return this.edgeItr++;
}

function GraphSetEdgeWidth(id, width) {
    var patch = new Patch(UpdateType.EDGE_ATTRIBUTE, this.edges[id].copy(), undefined);
    this.edges[id].width = width;
    patch.after = this.edges[id].copy();

    this._addPatch(patch);
    this.onChanged();
}

function GraphDeleteEdge(id, suppressCallBack) {
    var e = this.edges[id];
    if (e === undefined) return;
    var patch = new Patch(UpdateType.EDGE_DELETION, e.copy(), undefined);
    
    if (e.directed) {
        delete this.adjacencyList[e.source][e.target];
    } else {
        delete this.adjacencyList[e.source][e.target];
        delete this.adjacencyList[e.target][e.source];
    }
    
    delete this.edges[id];

    this._addPatch(patch);
    if (!suppressCallBack) this.onChanged();
}

function GraphCommit() {
    if (this.changeList.length === 0) return;
    this.undoStack.push(this.changeList.concat());
    this.changeList = [];
    this.redoStack = [];
    this.onChanged();
}

function GraphUndo() {
    if (this.undoStack.length === 0) return;
    var e = this.undoStack.pop();
    for (var i = e.length - 1; i >= 0; i--) {
        this._undoPatch(e[i]);
    }
    this.redoStack.push(e);
    this.onChanged();
}

function GraphRedo() {
    if (this.redoStack.length === 0) return;
    var e = this.redoStack.pop();
    for (var i = 0; i < e.length; i++) {
        this._redoPatch(e[i]);
    }
    this.undoStack.push(e);
    this.onChanged();
}
 
function GraphCanUndo() {
    return this.undoStack.length > 0;
}
   
function GraphCanRedo() {
    return this.redoStack.length > 0;
}

function GraphAddPatch(patch) {
    if (JSON.stringify(patch.before) === JSON.stringify(patch.after)) return;
    this.changeList.push(patch);
}

function GraphUndoPatch(patch) {
    switch (patch.type) {
    case UpdateType.NODE_ADDITION:
        var id = patch.after.id;
        delete this.nodes[id];
        delete this.adjacencyList[id];
        this.nodeItr--;
        break;

    case UpdateType.NODE_ATTRIBUTE:
        var id = patch.before.id;
        this.nodes[id] = patch.before.copy();
        break;

    case UpdateType.NODE_DELETION:
        var id = patch.before.id;
        this.nodes[id] = patch.before.copy();
        this.adjacencyList[id] = new Object();
        break;

    case UpdateType.EDGE_ADDITION:
        var e = patch.after;
        var id = e.id;
        delete this.edges[id];
        delete this.adjacencyList[e.source][e.target];
        if (!e.directed) delete this.adjacencyList[e.target][e.source];
        this.edgeItr--;
        break;

    case UpdateType.EDGE_ATTRIBUTE:
        var id = patch.before.id;
        this.edges[id] = patch.before.copy();
        break;

    case UpdateType.EDGE_DELETION:
        var e = patch.before;
        var id = e.id;
        this.edges[id] = e.copy();
        this.adjacencyList[e.source][e.target] = true;
        if (!e.directed) {
            this.adjacencyList[e.target][e.source] = true;
        }
        break;
    default:
        break;
    }
    this.onChanged();
}

function GraphRedoPatch(patch) {
    switch (patch.type) {
    case UpdateType.NODE_ADDITION:
        var node = patch.after
        var id = node.id
        this.nodes[id] = node.copy();
        this.adjacencyList[id] = new Object();
        this.nodeItr++;
        break;

    case UpdateType.NODE_ATTRIBUTE:
        var id = patch.after.id;
        this.nodes[id] = patch.after.copy();
        break;

    case UpdateType.NODE_DELETION:
        var id = patch.before.id;
        delete this.nodes[id];
        delete this.adjacencyList[id];
        break;

    case UpdateType.EDGE_ADDITION:
        var e = patch.after;
        var id = e.id;
        this.edges[id] = e.copy();
        this.adjacencyList[e.source][e.target] = true;
        if (!e.directed) {
            this.adjacencyList[e.target][e.source] = true;
        }
        this.edgeItr++;
        break;

    case UpdateType.EDGE_ATTRIBUTE:
        var id = patch.after.id;
        this.edges[id] = patch.after.copy();
        break;

    case UpdateType.EDGE_DELETION:
        var e = patch.before;
        var id = e.id;
        delete this.edges[id];
        delete this.adjacencyList[e.source][e.target];
        if (!e.directed) delete this.adjacencyList[e.target][e.source];
        break;
    default:
        break;
    }
    this.onChanged();
}


//-- exports
win.Graph = Graph;

})(window);