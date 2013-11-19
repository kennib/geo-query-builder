var builderRequest = angular.module('builder-request', ['builder-utils']);

/* Produce an angular JSON request object
   for requesting data from WMS/WFS servers */
builderRequest.service("geoRequest", function() {
  return function (params) {
    window.bbox = params.bbox;
    var data = {
      service: params.serviceType,
      request: params.requestType,
      outputFormat: params.format,
      format: params.format,
    };
    
    if (!$.isEmptyObject(params.bbox) && data.request != "GetCapabilities") {
      if (data.service == "WMS")
        data.bbox = [params.bbox.minx, params.bbox.miny, params.bbox.maxx, params.bbox.maxy].join();
      if (data.service == "WFS")
        data.bbox = [params.bbox.miny, params.bbox.minx, params.bbox.maxy, params.bbox.maxx].join();
    }

    if (data.service == "WMS" && data.request != "GetCapabilities") {
      data.layers = params.features ? params.features.join() : undefined;
      data.width = params.width;
      data.height = params.height;
    }
    if (data.service == "WFS" && data.request != "GetCapabilities") {
      data.typeName = params.feature;
      data.maxFeatures = params.featureLimit;
    }

    var request = {
      method: "GET",
      headers: {},
      url: params.host + "/ows",
      params: data,
    };

    return request;
  };
});

/* Produce a URI for the source of an image
   This image is produced from a WMS request */
builderRequest.service('geoImage', ['geoRequest', 'imageWidth', function(request, getImageWidth) {
  return function(host, features, bbox, height) {
    // Only map if there are features to map
    if (features) {
      $("#preview-image img").attr("src", "images/loading.gif");

      var imageParams = {
        host: host,
        serviceType: "WMS",
        requestType: "GetMap",
        outputFormat: "image/png",
        format: "image/png",
        width: getImageWidth(bbox, height),
        height: height,
        features: (typeof(features) == typeof([]))? features : [features],
        bbox: bbox,
      };

      var req = request(imageParams);
      var src = req.url + "?" + $.param(req.params);
      $("#preview-image img").attr("src", src);
    } else {
      return "";
    }
  };
}]);
