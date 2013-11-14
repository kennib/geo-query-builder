var wmsBuilder = angular.module("wms-builder", [
  "ngRoute",
]);

wmsBuilder.value("hosts", {
  "NICTA - GeoTopo250K": "http://geospace.research.nicta.com.au:8080/geotopo_250k/web/",
  "NICTA - Admin Bounds": "http://geospace.research.nicta.com.au:8080/admin_bnds/web/",
});

wmsBuilder.controller("builder", ["$scope", "hosts", function($scope, hosts) {
  $scope.hosts = hosts;
}]);
