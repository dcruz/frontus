var app = angular.module('pricing', ['ui.bootstrap', 'nav', 'brijj', 'external', 'registerDirective'], function($routeProvider, $locationProvider){
  $locationProvider.html5Mode(true).hashPrefix('');

  $routeProvider.
      when('/', {}).
      otherwise({redirectTo:'/'});
});