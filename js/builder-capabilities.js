var builderCap = angular.module('builder-capabilities', ['builder-request', 'builder-defaults']);

/* Get the capabilities of a WMS/WFS service */
builderCap.service("requestCapabilities", ['$http', 'geoRequest',  function($http, request) {
  return function(request) {
    request.params.request = "GetCapabilities";
    request.headers["Accept"] = "application/xml";
    return $http(request);
  };
}]);

/* Takes the xml string containing the capabilities
   and return JSON object with the key data/properties */
builderCap.service('processCapabilities', ['defaults', function(defaults) {
  return function(serviceType, xml) {
    // An object which will contain the capabilities
    // from the xml capabilities string
    var cap = {};

    // Process the WMS capabilities
    if (serviceType == "WMS") {
      var cap = $.xml2json(xml).Capability;

      // Get request types
      var requestTypes = cap.Request;
      for (var rt in requestTypes) {
        var formats = requestTypes[rt].Format;

        if (typeof(formats) != typeof([]))
          requestTypes[rt].formats = [formats];
        else
          requestTypes[rt].formats = formats;
      }

      // Get layer names and bounding boxes
      var layers = [];
      var Layer = cap.Layer.Layer;
      for (var l in Layer) {
        var layer = {
          bbox: Layer[l].BoundingBox[0],
          name: Layer[l].Name,
        };
        layers[layer.name] = layer;
      }

      cap.requestTypes = requestTypes;
      cap.featureList = layers;
    }

    // Process the WFS capabilities
    if (serviceType == "WFS") {
      // Get request types
      var requestTypes = {};
      $(xml)
        .find('ows\\:operationsmetadata')
        .children('ows\\:operation')
        .each(function() {
          var op = $(this);
          var name = op.attr("name");
          var formats = [];
          op.find('ows\\:parameter[name="outputFormat"]')
            .children().children().each(function() {
              formats.push($(this).text());
            });
          requestTypes[name] = {formats: formats};
        });

      // Get feature names and bounding boxes
      var featureTypes = [];
      $(xml)
        .find('featuretypelist')
        .children('featuretype')
        .each(function() {
          var feature = $(this);
          var name = feature .children('name').text();
          var box = feature.children('ows\\:wgs84boundingbox');
          var min = box.children('ows\\:lowercorner').text().split(' ');
          var max = box.children('ows\\:uppercorner').text().split(' ');
          var bbox = {minx: min[0], maxx: max[0], miny: min[1], maxy: max[1]};
          featureTypes[name] = {name: name, bbox: bbox};
        });

      cap.requestTypes = requestTypes;
      cap.featureList = featureTypes;
    }

    // Set new defaults
    var def = defaults[serviceType];
    cap.requestType = def.requestType;
    cap.format = def.format;

    return cap;
  }
}]);
