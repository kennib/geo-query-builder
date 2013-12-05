var builderCap = angular.module('builder-capabilities', ['builder-request', 'builder-defaults']);

/* Get the capabilities of a WMS/WFS service */
builderCap.service("requestCapabilities", ['$http', 'geoRequest',  function($http, request) {
  return function(params) {
    var cap = {
      host: params.host,
      service: params.service,
      request: "GetCapabilities",
      timeout: params.timeout,
    };

    var req = request(cap);

    return $http(req);
  };
}]);

/* Takes the xml string containing the capabilities
   and return JSON object with the key data/properties */
builderCap.service('processCapabilities', ['defaults', function(defaults) {
  return function(service, xml) {
    // An object which will contain the capabilities
    // from the xml capabilities string
    var cap = {};

    // Process the WMS capabilities
    if (service == "WMS") {
      var cap = $.xml2json(xml).Capability;

      // Get request types
      var requests = cap.Request;
      for (var rt in requests) {
        var formats = requests[rt].Format;

        if (typeof(formats) != typeof([]))
          requests[rt].formats = [formats];
        else
          requests[rt].formats = formats;
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

      cap.requests = requests;
      cap.featureList = layers;
    }

    // Process the WFS capabilities
    if (service == "WFS") {
      // Get request types
      var requests = {};
      var versions = [];
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
          requests[name] = {formats: formats};

          op.find('ows\\:parameter[name="AcceptVersions"]')
            .children().children().each(function() {
              versions.push($(this).text());
            });
        });

      // Get feature names and bounding boxes
      var featureTypes = [];
      $(xml)
        .find('featuretypelist')
        .children('featuretype')
        .each(function() {
          var feature = $(this);
          var name = feature.children('name').text();
          var box = feature.children('ows\\:wgs84boundingbox');
          var min = box.children('ows\\:lowercorner').text().split(' ');
          var max = box.children('ows\\:uppercorner').text().split(' ');
          var bbox = {minx: min[0], maxx: max[0], miny: min[1], maxy: max[1]};
          featureTypes[name] = {name: name, bbox: bbox};
        });

      cap.requests = requests;
      cap.featureList = featureTypes;
      cap.versions = versions;
      cap.version = versions[versions.length-1]; // Pick the latest version
    }

    // Set new defaults
    cap.defaults = defaults[service];

    return cap;
  }
}]);
