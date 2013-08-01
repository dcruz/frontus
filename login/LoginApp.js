//app for the program
var app = angular.module('LoginApp', ['brijj']);

//this is used to assign the correct template and controller for each URL path
app.config(function($routeProvider, $locationProvider){
  $locationProvider.html5Mode(true).hashPrefix('');
  // $locationProvider.html5Mode(false).hashPrefix('!');

  $routeProvider.
      when('/', {controller:LoginCtrl, templateUrl:'login.html'}).
      when('/forgot', {controller:ForgotCtrl, templateUrl: 'forgot.html'}).
      when('/sent', {controller:SentCtrl, templateUrl: 'sent.html'}).
      when('/home', {controller:HomeCtrl, templateUrl:'home.html'}).
      when('/logout', {controller: LogoutCtrl, templateUrl: 'logout.html'}).
      when('/reset', {controller: ResetCtrl, templateUrl: 'reset.html'}).
      otherwise({redirectTo:'/'});
});


//Controller for the Login Page
function LoginCtrl($scope, $location, SWBrijj){
    document.cookie = "selectedCompany=; expires=Fri, 18 Feb 1994 01:23:45 GMT; path=/";
    $scope.username = "";
    $scope.password = "";
    $scope.showError = false;
    $scope.doLogin = function() {
      SWBrijj.login($scope.username, $scope.password).then(function(x) { 
         if(x) {
			document.location.href = x;
			console.log("redirecting to: "+x);
		}
         else $scope.showError = true;
      });
    }
    
    // could also add that the password is not long enough?
    $scope.loginDisabled = function() {
        return $scope.username == null || $scope.username.length < 3 || $scope.password.length < 6;
    }
    $scope.loginClass = function() {
        return "button greenButton loginButton bodyText" + ($scope.loginDisabled() ? " adisabled" : "");
    }
};

function LogoutCtrl($scope, SWBrijj) {
  $scope.doLogout = function() {
    document.cookie = "selectedCompany=; expires=Fri, 18 Feb 1994 01:23:45 GMT; path=/";
    SWBrijj.logout().then(function(x) {
      document.location.href='/?logout=1';
    });
  }
}

//Controller for the home page
function HomeCtrl($scope){
    $scope.user = function(){
      document.location.href = '/investor/profile';
//      return $routeParams.userName;
    };
}

//Controller for the home page
function ForgotCtrl($scope, $location, SWBrijj) {
    $scope.username="";
    $scope.fed="";
    $scope.showReset = false;
    
    $scope.forgotDisabled = function() { 
        return $scope.username == null || $scope.username.length < 3; }
    $scope.forgotClass = function() {
         return "button greenButton loginButton bodyText" + ($scope.forgotDisabled() ? " adisabled" : ""); }
    $scope.doForgot = function() {
      $scope.forgotDisabled = function() { return true; }
      SWBrijj.forgot($scope.username).then(function(x) {
        $location.path("/sent");
      }).except(function(x) { 
        $scope.fed = "There was an error. Please try again later."
      });
    }
};

function ResetCtrl($scope, $route, $routeParams, SWBrijj) {
  $scope.resetDisabled = function() { return $scope.password == null || $scope.password.length < 1; }
  $scope.resetClass = function() { return "button greenButton loginButton bodyText" + ($scope.resetDisabled() ? " adisabled" : ""); }
  $scope.doReset = function() {
    $scope.resetDisabled = function() { return true; }
    SWBrijj.resetPassword($scope.password, $routeParams.code).then(function(x) {
      document.location.href="/login";
    }).except(function(x) { 
      console.log(x);
      $scope.fed = "There was an error. Please try again later."
    });
  }
}

function SentCtrl() {
}
