
var app = angular.module('ProfileApp', ['ngResource', 'ui.bootstrap', 'ui.event', 'brijj']);

//this is used to assign the correct template and controller for each URL path
app.config(function($routeProvider, $locationProvider){
  $locationProvider.html5Mode(true).hashPrefix('');
  // $locationProvider.html5Mode(false).hashPrefix('!');

  $routeProvider.
      when('/', {controller:ContactCtrl, templateUrl:'contact.html'}).
      // when('/social', {controller:SocialCtrl, templateUrl: 'social.html'}).
      // when('/password', {controller:PasswordCtrl, templateUrl: 'password.html'}).
      //when('/photo', {controller:PhotoCtrl, templateUrl: 'photo.html'}).
      otherwise({redirectTo:'/'});
});

app.controller("MainProfileController", function($scope, $location) {
    $scope.toPassword = function() { $location.path('password') };
    $scope.toContact = function() { $location.path('contact') };
    $scope.toSocial = function() { $location.path('social') };
    $scope.toPhoto = function() { $location.path('photo') };
    $scope.tab = function(x) { 
      var p = $location.path();  if (p == '/') p='contact';
      return p == x; };
} );

function ContactCtrl($scope, $route, $rootScope, SWBrijj) {

  $scope.pictureModalOpen = function () {
    $scope.pictureModal = true;
  };

  $scope.pictureModalClose = function () {
    $scope.closeMsg = 'I was closed at: ' + new Date();
    $scope.pictureModal = false;
  };

  $scope.passwordModalOpen = function () {
    $scope.passwordModal = true;
  };

  $scope.passwordModalClose = function () {
    $scope.closeMsg = 'I was closed at: ' + new Date();
    $scope.passwordModal = false;
  };

  $scope.opts = {
    backdropFade: true,
    dialogFade:true
  };

  $scope.contactSave = function () {
    if ($scope.detectChanges != $scope.name + $scope.street) {
      $scope.detectChanges = $scope.name + $scope.street;
      if ($scope.name.replace(/[^a-z0-9]/gi,'').length < 2) {
        $rootScope.notification.show("fail", "Please enter a name more than 1 letter in length");
        $scope.name = $scope.namekey;
        return;
      }
      SWBrijj.proc("account.contact_update", $scope.name, $scope.street).then(function (x) { 
          console.log("saved: "+x);
          $rootScope.notification.show("success", "Profile successfully updated");
          $scope.namekey = $scope.name;
      }).except(function(x) {
          $scope.namekey = $scope.name;
          $rootScope.notification.show("fail", "Something went wrong, please try again later.");
      });
    }
  }

  SWBrijj.tbl('account.profile').then(function(x) { 
    initPage($scope, x);
    $scope.photoURL = '/photo/user?id=' + $scope.email;
    $scope.namekey = $scope.name;
    $scope.detectChanges = $scope.name + $scope.street;
  }).except(initFail);

  $scope.uploadFile = function() {
    $scope.photoURL = "/img/image-loader-140.png";
    var fd = new FormData();
    $scope.progressVisible = true;
    for (var i in $scope.files) fd.append("uploadedFile", $scope.files[i]);
    SWBrijj.uploadImage(fd).then(function(x) {
      console.log(x);
      $scope.photoURL = '/photo/user?id=' + $scope.email;
      $rootScope.notification.show("green", "Profile photo successfully updated");
    }).except( function(x) { 
      console.log(x);
      $rootScope.notification.show("fail", "Profile photo change was unsuccessful, please try again.");
    });
  };

  $scope.setFiles = function(element) {
    $scope.files = [];
    for (var i = 0; i < element.files.length; i++) { $scope.files.push(element.files[i]); }
  };
}

function SocialCtrl($scope, $location, SWBrijj) {  
  $scope.contactSave = function(){
     SWBrijj.proc("social_update", $scope.twitter, $scope.linkedin, $scope.google, $scope.dropbox, $scope.facebook).
        then(function(x) { alert("done: "+x); });
  }

  $scope.authTwitter = function() {
    SWBrijj.proc("oauth.twitter_authorize").then(function(x) { document.location.href=x[1][0]; });
  }
  $scope.authLinkedin = function() {
    SWBrijj.proc("oauth.linkedin_authorize").then(function(x) {
      document.location.href=x[1][0]; });
  }
  $scope.authDropbox = function() {
      SWBrijj.proc("oauth.dropbox_authorize").then(function(x) { document.location.href=x[1][0]; });
  }
  $scope.authGoogle = function() {
    SWBrijj.proc("oauth.google_authorize").then(function(x) { document.location.href=x[1][0]; });
  }
  $scope.authFacebook = function() {
    SWBrijj.proc("oauth.facebook_authorize").then(function(x) { document.location.href=x[1][0]; });
  }


    SWBrijj.tbl('account.profile').then(function(x) { initPage($scope, x) }).except(initFail);
    SWBrijj.procm('oauth.dropbox_list','')
      .then(function(x)  { $scope.dropboxFiles=x; $scope.$apply(); })
      .except( function(x) {} );

}

function PasswordCtrl($scope, $route, $rootScope, SWBrijj) {
    $scope.currentPassword="";
    $scope.newPassword="";
    $scope.passwordConfirm="";
    
    $scope.validPasswordNot = function() { 
        return !($scope.currentPassword && $scope.passwordMatches());
        // return !($scope.currentPassword && !($scope.passwordMatchesNot() || $scope.regexPassword())); };
    }

    $scope.regexPassword = function() {
        var newP = $scope.newPassword;
    	if (newP.match(/(?=.*?[a-z])(?=.*?[A-Z])(?=.*?[0-9]).{8,}/)) return "";
    	else if (newP.match(/(?=.*?[a-z])(?=.*?[A-Z]).{8,}/)) return "Missing a digit";
    	else if (newP.match(/(?=.*?[a-z])(?=.*?[0-9]).{8,}/)) return "Missing an uppercase letter";
    	else if (newP.match(/(?=.*?[0-9])(?=.*?[A-Z]).{8,}/)) return "Missing a lowercase letter";
    	else if (newP.length < 8) return "Must be at least eight characters";
    	else return "Must contain at least one lowercase letter, one uppercase letter, and one digit";
    };
    
    $scope.passwordMatches = function() {
        return $scope.passwordConfirm && $scope.newPassword && $scope.passwordConfirm == $scope.newPassword ; 
    };
    
    $scope.changePassword = function() {
        SWBrijj.proc("account.change_password", $scope.currentPassword, $scope.newPassword).then(function(x) {
            if (x[1][0]) { 
              $rootScope.notification.show("success", "Your password has been updated successfully.");
              console.log("changed successfully");
            } else { 
              $rootScope.notification.show("fail", "There was an error updating your password.");
              console.log("Oops.  Change failed");
            }
        }).except(function(x) {alert("Oops.  Change failed: "+x); });
    };
}

function PhotoCtrl($scope, SWBrijj) {
    $scope.upload = function () {
        alert('heh');
    };
    
    SWBrijj.tbl('account.profile').then(function(x) { initPage($scope,x) }).except(initFail);
}

function initPage($scope, x, row) {
  if(typeof(row)==='undefined') row = 1;
  var y = x[0]; // the fieldnames
  var z = x[row]; // the values
  
  for(var i=0;i<y.length;i++) { if (z[i] !== null) { $scope[y[i]]=z[i]; } }
}
	function initFail(x) {
		document.location.href='/login';
	}

	function updated(x) {}