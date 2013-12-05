var builder = angular.module("builder", [
  "ngRoute", "builder-request", "builder-capabilities",
]);

/* Filter an array by the objects in another array */
builder.filter("isIn", function() {
  function isIn(obj, array) {
    return array && (array.indexOf(obj) != -1 || array[obj] !== undefined);
  };

  return function(obj, filterArray) {
    var newObj = {};
    
    for (var key in obj) {
      if (isIn(key, filterArray) || isIn(obj[key], filterArray))
        newObj[key] = obj[key];
    }

    return newObj;
  };
});

builder.value("hosts", {
  "NICTA - GeoTopo250K": "http://envirohack.research.nicta.com.au/geotopo_250k",
  "NICTA - Admin Bounds": "http://envirohack.research.nicta.com.au/admin_bnds_abs",
  "NICTA - FSDF Administrative Units": "http://envirohack.research.nicta.com.au/fsdf",
  "Atlas of Living Australia": "http://spatial.ala.org.au/geoserver/ALA",
});

builder.value("services", [
  "WMS",
  "WFS",
]);

builder.service("request", ["defaults", "hosts", "services",
function(defaults, hosts, services) {
  return {
    host: hosts[defaults.host],
    service: defaults.service,
    version: undefined,
    request: undefined,
    bounds: defaults.bounds,
    features: [],
    image: {
      width: defaults.image.width,
      height: defaults.image.height,
    },
    maxfeatures: defaults.maxfeatures,
    ECQLfilter: defaults.ECQLfilter,
  };
}]);

builder.service("settings", ["defaults", function(defaults) {
  return {
    manualinput: defaults.settings.manualinput,
    autobounds: defaults.settings.autobounds,
    proportional: defaults.settings.proportional,
    timeout: defaults.settings.timeout,
  };
}]);

builder.controller("builder", ["$scope", "$http",
  "requestCapabilities", "processCapabilities",
  "geoRequest", "geoCURL", "geoImage", "geoFeatureInfo", "processFeatureInfo",
  "imageWidth", "imageHeight",
  "request", "settings",
  "hosts", "services",
  function($scope, $http,
    requestCapabilities, processCapabilities,
    geoRequest, getCURL, getImageURL, getFeatureInfo, processFeatureInfo,
    getImageWidth, getImageHeight,
    request, settings,
    hosts, services
  ) {
    window.scope = $scope;

    $scope.request = request;
    $scope.settings = settings;

    $scope.hosts = hosts;
    $scope.services = services;

    // Function to generate a request
    $scope.requestURL = function() {
      return geoRequest($scope.request);
    };

    // Initialize the Google map
    var map = initMap();
    // Update bounds on map rectangle update
    function updateMapBounds(bounds) {
      var ne = map.rectangle.getBounds().getNorthEast();
      var sw = map.rectangle.getBounds().getSouthWest();
      
      $scope.request.bounds = {
        minx: sw.lng(),
        maxx: ne.lng(),
        miny: sw.lat(),
        maxy: ne.lat(),
      };

      $scope.$apply('request.bounds');
    }
    var boundsListener = google.maps.event.addListener(map.rectangle, 'bounds_changed', updateMapBounds);
    // Update rectangle on bounds update
    $scope.$watch('request.bounds', function(bbox) {
      var ne = map.rectangle.getBounds().getNorthEast();
      var sw = map.rectangle.getBounds().getSouthWest();

      if (bbox && bbox.minx && bbox.maxx && bbox.miny && bbox.maxy) {
        var bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(bbox.miny, bbox.minx),
          new google.maps.LatLng(bbox.maxy, bbox.maxx)
        );

        // Add and remove listener to stop an infinite update loop
        // between the map and the bounds inputs
        google.maps.event.removeListener(boundsListener);
        map.rectangle.setOptions({bounds: bounds}); // do the update
        boundsListener = google.maps.event.addListener(map.rectangle, 'bounds_changed', updateMapBounds);
      }
    });

    // Create curl text
    $scope.CURL = function() {
      return getCURL($scope.request);
    }

    // Create a URL for the request
    $scope.url = function(override) {
      var req = geoRequest($scope.request);
      return req.url + "?" + decodeURIComponent($.param(req.params));
    }

    // Create an image link for the request
    $scope.imageURL = function() {
      getImageURL($scope.request, 200);
    };

    // Get the capabilities of the current WMS/WFS server selection
    function updateCapabilities(updated) {
      // Reset old features if there is a new host
      if (updated && $scope.request.host == updated) {
        $scope.request.features = undefined;
        $scope.request.feature = undefined;
        $scope.featureList = undefined;
        
        $scope.requestTypes = undefined;
      }

      // Get the new capabilities
      if ($scope.request.host) {
        requestCapabilities($scope.request).success(function(xml) {
          // Apply capabilities to the scope
          var cap = processCapabilities($scope.request.service, xml);
          angular.extend($scope, cap);
          angular.extend($scope.request, cap.defaults);
          $scope.capabilitiesError = null;
        }).error(function(error) {
          $scope.capabilitiesError = error? error : "Unable to retrieve the server's capabilities.";

        });
      }
    };
    // Update capabilities if the host or service type changes
    $scope.$watch('request.host', updateCapabilities);
    $scope.$watch('request.service', updateCapabilities);

    // Update the list of properties for the features of this service
    function updateFeatureProperties() {
      getFeatureInfo($scope.request).success(function(xml) {
        $scope.featureInfo = processFeatureInfo(xml);
        $scope.capabilitiesError = null;
      }).error(function(error) {
        $scope.capabilitiesError = error? error: "Unable to retreive the feature's properties";
      });
    }
    $scope.$watch('request.host', updateFeatureProperties);
    $scope.$watch('request.service', updateFeatureProperties);

    // Update the bounding box based on the layer/feature selection
    function updateBBox(feature) {
      if (feature && $scope.settings.autobounds) {
        var bbox = $scope.featureList[feature].bbox;
        $scope.request.bounds = bbox;
      }
    }
    $scope.$watch('request.feature', updateBBox);

    // Update the feature when features are selected
    $scope.$watch('request.features', function(features) {
      if (features && features.length > 0) {
        $scope.request.feature = features[0];
      }
    });
    // Update the features when a feature is selected
    $scope.$watch('request.feature', function(feature) {
      if (feature) {
        $scope.request.features = [feature];
      }
    });
    
    // Update the width when the height or bbox changes
    // Update the height when the width changes
    function updateImageDimensions(newimg, oldimg) {
      newimg = angular.copy(newimg); // avoid changing the newimg data

      if (oldimg && $scope.settings.proportional && !$scope.autoResizing) {
        var bboxChanged = newimg.width === undefined;

        // Update height if width changed or bbox is changed or propotionality changed
        if (bboxChanged || newimg.width !== oldimg.width)
          $scope.request.image.height = getImageHeight($scope.request.bounds, $scope.request.image.width);

        // Update width if height changed
        if (newimg.height !== oldimg.height)
          $scope.request.image.width = getImageWidth($scope.request.bounds, $scope.request.image.height);

        $scope.autoResizing = true;  // stop the next update
      } else {
        $scope.autoResizing = false; // this update doesn't do anything, but the next update will
      }
    }
    $scope.$watch('request.image', updateImageDimensions, true);
    $scope.$watch('request.bounds', updateImageDimensions);
    $scope.$watch('settings.proportional', function() {
      updateImageDimensions(true, true);
    });

    // Update whether to include a feature's properties
    $scope.includeProperties = function(feature, include) {
      for (var p in feature) {
        var prop = feature[p];
        prop.include = include;
      }
    };
  }]);

function initMap() {
  var mapOptions = {
    center: new google.maps.LatLng(-31.952162,135.175781), // Australia
    zoom: 1,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };

  var map = new google.maps.Map(document.getElementById("map"), mapOptions);

  var rectangle = new google.maps.Rectangle({
    bounds: new google.maps.LatLngBounds(),
    editable: true,
    draggable: true,
  });

  rectangle.setMap(map);

  return {map: map, rectangle: rectangle};
}
