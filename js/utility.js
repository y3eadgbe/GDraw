var EPS = 1e-9;

var dot = function(p, q) {
    return p[0] * q[0] + p[1] * q[1];
}

var cross = function(p, q) {
    return p[0] * q[1] - p[1] * q[0];
}

var minus = function(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}

var abs = function(a) {
    return Math.sqrt(a[0] * a[0]  + a[1] * a[1]);
}

var distanceSP = function(a, b, p) {
    if (dot(minus(b, a), minus(p, a)) < EPS) return abs(minus(a, p));
    if (dot(minus(a, b), minus(p, b)) < EPS) return abs(minus(b, p));
    console.log(abs(minus(b, a)));
    return Math.abs(cross(minus(b, a), minus(p, a))) / abs(minus(b, a));
}

var HSVtoRGB = function(hsv) {
    var h = hsv[0];
    var s = hsv[1];
    var v = hsv[2];
    var c = v * s;

    var hp = h / 60.0;
    var x = c * (1 - Math.abs(hp % 2 - 1));

    var ans = [v - c, v - c, v - c];
    if (hp < 1) {
        ans[0] += c;
        ans[1] += x;
    } else if (hp < 2) {
        ans[0] += x;
        ans[1] += c;
    } else if (hp < 3) {
        ans[1] += c;
        ans[2] += x;
    } else if (hp < 4) {
        ans[1] += x;
        ans[2] += c;
    } else if (hp < 5) {
        ans[0] += x;
        ans[2] += c;
    } else {
        ans[0] += c;
        ans[2] += x;
    }

    for (var i = 0; i < 3; i++) {
        ans[i] *= 255;
    }

    return ans;
}

var getColormapJet = function(n) {
    n = n === undefined ? 32 : n;
    var ans = [];
    for (var i = 0; i < n; i++) {
        ans.push(HSVtoRGB([240 * (1.0 - (i / (n - 1))) ,0.6, 0.8]));
    }
    return ans;
}

var getColormapGray = function(n) {
    n = n === undefined ? 32 : n;
    var ans = [];
    for (var i = 0; i < n; i++) {
        ans.push(HSVtoRGB([0, 0, 1.0 - (i / (n - 1))]));
    }
    return ans;
}

var setNodeColorByColorMap = function(graph, values, valueMin, valueMax, colorMap) {
    colorMap = colorMap === undefined ? getColormapJet() : colorMap;
    if (values.length == 0) return;
    console.log(colorMap);

    var N = colorMap.length;
    var valueArray = Object.keys(values).map(function (key) {return values[key]});
    valueMax = valueMax === undefined ? Math.max.apply(null, valueArray) : valueMax;
    valueMin = valueMin === undefined ? Math.min.apply(null, valueArray) : valueMin;
    if (valueMin > valueMax) valueMax = valueMin;

    for (var key in values) {
        var v = valueMax - valueMin === 0 ? 0 : (values[key] - valueMin) / (valueMax - valueMin);
        var index = Math.floor(v * N);
        if (index >= N) index = N - 1;
        if (index < 0) index = 0;
        console.log(colorMap[index]);
        graph.setNodeColor(key, d3.rgb(colorMap[index][0], colorMap[index][1], colorMap[index][2]).toString());
    }
    graph.commit();
}
