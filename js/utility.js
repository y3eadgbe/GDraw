/*
 * Math Functions
 */

var EPS = 1e-9;

var dot = function(p, q) {
    return p[0] * q[0] + p[1] * q[1];
};

var cross = function(p, q) {
    return p[0] * q[1] - p[1] * q[0];
};

var minus = function(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
};

var abs = function(a) {
    return Math.sqrt(a[0] * a[0]  + a[1] * a[1]);
};

var distanceSP = function(a, b, p) {
    if (dot(minus(b, a), minus(p, a)) < EPS) return abs(minus(a, p));
    if (dot(minus(a, b), minus(p, b)) < EPS) return abs(minus(b, p));
    console.log(abs(minus(b, a)));
    return Math.abs(cross(minus(b, a), minus(p, a))) / abs(minus(b, a));
};

/*
 * Utilities
 */

var downloadText = function(fileName, text) {
    var blob = new Blob([text], {type: "text/plain"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.target = "_blank";
    a.download = fileName;
    a.click();
};
