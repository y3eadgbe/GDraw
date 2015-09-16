var isConnected = function(graph) {
    var N = Object.keys(graph.nodes).length;
    var stack = [];
    var visited = new Object();

    if (N == 0) return true;
    stack.push(Object.keys(graph.nodes)[0]);

    while (stack.length > 0) {
        var e = stack.pop();
        if (visited[e] == true) continue;
        visited[e] = true;
        targets = Object.keys(graph.adjacencyList[e]);
        for (var v in targets) {
            stack.push(targets[v]);
        }
    }
    return Object.keys(visited).length == N;
}

var closenessCentrality = function(graph) {
    var N = Object.keys(graph.nodes).length;
    var ans = new Object();

    for (var key in graph.nodes) {
        ans[key] = 0;
    }
    if (N <= 1) return ans;
    if (!isConnected(graph)) return ans;

    for (var key in graph.nodes) {
        var queue = [];
        var visited = new Object();

        queue.push([key, 0]);
        
        while (queue.length > 0) {
            var e = queue.shift();
            var v = e[0];
            var cost = e[1];
            if (visited[v] == true) continue;
            visited[v] = true;
            ans[key] += cost;
            
            targets = Object.keys(graph.adjacencyList[v]);
            for (var u in targets) {
                queue.push([targets[u], cost + 1]);
            }
        }
    }

    for (var key in ans) {
        ans[key] = 1.0 / ans[key];
    }
    return ans;
}
