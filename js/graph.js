(function(win) {

//-- interface
var Graph = function(onChanged) {
    this.onChanged = onChanged;
    this.nodes = new Object();
    this.edges = new Object();
    this.adjacencyList = new Object();
    this.nodeItr = 0;
    this.edgeItr = 0;    
}

Graph.prototype = {
    constructor:   Graph,              // Graph(onChanged)
    addNode:       GraphAddNode,       // addNode(x, y, radius, width)
    deleteNode:    GraphDeleteNode,    // deleteNode(id)
    setNodeRadius: GraphSetNodeRadius, // setNodeRadius(id, radius)
    setNodeWidth:  GraphSetNodeWidth,  // setNodeWidth(id, width)
    addEdge:       GraphAddEdge,       // addEdge(source, target, directed, width)
    deleteEdge:    GraphDeleteEdge,    // deleteEdge(id)
    setEdgeWidth:  GraphSetEdgeWidth,  // setEdgeWidth(id, width)
    //draw:          GraphDraw           // draw()
};

//-- implementation

var Node = function(id, x, y, radius, width) {
    this.id = id;
    this.x = x === undefined ? 0 : x;
    this.y = y === undefined ? 0 : y;
    this.vx = this.x;
    this.vy = this.y;
    this.radius = radius === undefined ? 20 : radius;
    this.width = width === undefined ? 2 : width
}

var Edge = function(id, source, target, directed, width) {
    this.id = id;
    this.source = source;
    this.target = target;
    this.directed = directed;
    this.width = width === undefined ? 2 : width;
}

function GraphAddNode(x, y, radius, width) {
    this.nodes[this.nodeItr] = new Node(this.nodeItr, x, y, radius, width);
    this.adjacencyList[this.nodeItr] = new Object();
    this.onChanged();
    return this.nodeItr++;
}

function GraphSetNodeRadius(id, radius) {
    this.nodes[id].radius = radius;
    this.onChanged();
}

function GraphSetNodeWidth(id, width) {
    this.nodes[id].width = width;
    this.onChanged();
}

function GraphDeleteNode(id) {
    var v = this.nodes[id];
    if (v === undefined) return;
    
    for (var i in this.edges) {
        var e = this.edges[i];
        if (e.source == id || e.target == id) this.deleteEdge(i, true);
    }
    
    delete this.nodes[id];
    delete this.adjacencyList[id];
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
    this.onChanged();
    return this.edgeItr++;
}

function GraphSetEdgeWidth(id, width) {
    this.edges[id].width = width;
    this.onChanged();
}

function GraphDeleteEdge(id, suppressCallBack) {
    var e = this.edges[id];
    if (e === undefined) return;
    
    if (e.directed) {
        delete this.adjacencyList[e.source][e.target];
    } else {
        delete this.adjacencyList[e.source][e.target];
        delete this.adjacencyList[e.target][e.source];
    }
    
    delete this.edges[id];
    if (!suppressCallBack) this.onChanged();
}

//-- exports
win.Graph = Graph;

})(window);