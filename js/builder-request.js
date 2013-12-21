var builderRequest = angular.module('builder-request', ['builder-utils']);

/* Produce an angular JSON request object
   for requesting data from WMS/WFS servers */
builderRequest.service("geoRequest", function() {
  return function (params) {
    var data = {
      service: params.service,
      request: params.request,
    };

    if (params.cql_filter) {
      data.cql_filter = params.ECQLfilter;
    }
    
    if (!$.isEmptyObject(params.bounds) && data.request != "GetCapabilities") {
      if (data.service == "WMS")
        data.bbox = [params.bounds.minx, params.bounds.miny, params.bounds.maxx, params.bounds.maxy].join();
      if (data.service == "WFS" && !params.cql_filter)
        data.bbox = [params.bounds.miny, params.bounds.minx, params.bounds.maxy, params.bounds.maxx].join();
    }

    if (data.service == "WMS" && data.request != "GetCapabilities") {
      data.layers = params.features ? params.features.join() : undefined;
      data.width = params.image? params.image.width : 0;
      data.height = params.image? params.image.height : 0;
      data.format = params.format;
    }
    if (data.service == "WFS" && data.request != "GetCapabilities") {
      data.typeName = params.feature;
      if (/^1/.test(params.version)) // version 1 and 2 differ in feature limit paramater names
        data.maxFeatures = params.maxfeatures;
      else
        data.count = params.maxfeatures;
      data.outputFormat = params.format;
      data.version = params.version;
    }

    // Get a list of properties to include
    if (params.featureInfo) {
      var props = [], numProperties = 0;

      // Get the properties of each feature
      for (var f in params.features) {
        var feature = params.features[f];
        var properties = params.featureInfo[feature];
        for (var p in properties) {
          var prop = properties[p];
          numProperties++;
          if (prop.include)
            props.push(prop.name);
        }
      }

      if (numProperties != props.length && numProperties != 0)
        data.propertyName = props.join(',');
    }

    var request = {
      method: "GET",
      headers: {},
      url: params.host + "/ows",
      params: data,
      timeout: params.timeout,
    };

    return request;
  };
});

/* Produce an angular JSON request object
   for requesting data from WMS/WFS servers */
builderRequest.service("geoCURL", ["geoRequest", function(geoRequest) {
  return function(params) {
    var req = geoRequest(params);
    var curl = "curl " + req.url + " --get";

    for (var key in req.params) {
      curl += " -d ";
      curl += JSON.stringify(key + "=" + req.params[key]);
    }

    return curl;
  };
}]);

/* Produce a URI for the source of an image
   This image is produced from a WMS request */
builderRequest.service('geoImage', ['geoRequest', 'imageWidth', function(request, getImageWidth) {
  return function(params, height) {
    // Only map if there are features to map
    if (params.features) {
      $("#preview-image img").attr("src", "images/loading.gif");

      var imageParams = {
        host: params.host,
        service: "WMS",
        request: "GetMap",
        outputFormat: "image/png",
        format: "image/png",
        image: {
          width: getImageWidth(params.bounds, height),
          height: height,
        },
        features: (typeof(params.features) == typeof([]))? params.features : [params.features],
        bounds: params.bounds,
        ECQLfilter: params.ECQLfilter,
      };

      var req = request(imageParams);
      var src = req.url + "?" + $.param(req.params);
      $("#preview-image img").attr("src", src);
    } else {
      return "";
    }
  };
}]);

/*Request the properties of a feature set
   This feature set is produced from a WFS request*/
builderRequest.service('geoFeatureInfo', ['$http', 'geoRequest', function($http, request) {
  return function(params) {
    var featureInfoParams = {
      host: params.host,
      service: "WFS",
      request: "DescribeFeatureType",
      feature: params.feature,
    };
    var req = request(featureInfoParams);
    return $http(req);
  }
}]);

/* Produce a JSON object encoding the properties of a feature set
   Created from an xml string */
builderRequest.service('processFeatureInfo', [function() {
  return function(xml) {
    var info = {};
    var infoxml = $(xml);
    // Get the list of features
    var features = infoxml.find('xsd\\:complexType');
    
    features.each(function(feature) {
      feature = $(this);
      var f = {};
      var featureName = feature.next().attr("type").replace(/Type$/, '');
      info[featureName] = f;
      
      // Get the list of properties for a feature
      var props = feature.find('xsd\\:element');
      props.each(function(prop) {
        var prop = $(this);
        var name = prop.attr("name");
        var type = prop.attr("type");
        f[name] = {name: name, type: type, include: true};
      });
      
    });

    return info;
  };
}]);
