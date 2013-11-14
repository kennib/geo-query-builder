var wmsBuilder = angular.module("wms-builder", [
  "ngRoute",
]);


wmsBuilder.controller("builder", ["$scope", function($scope) {
  $scope.url = "http://geospace.research.nicta.com.au:8080/admin_bnds/web/";
}]);
