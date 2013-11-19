var builderUtils = angular.module('builder-utils', []);

/* Get the proportional image width
   based on bounding box dimensions and given height */
builderUtils.service('imageWidth', function() {
  return function imageWidth(bbox, height) {
    if (bbox) {
      var w = Math.abs(bbox.minx - bbox.maxx);
      var h = Math.abs(bbox.miny - bbox.maxy);
      var ratio = w/h;

      return parseInt(height * ratio);
    }
  }
});
