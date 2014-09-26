'use strict';

app.controller('chooseGrantIssue',
    ["$scope", "grants", "Documents", function($scope, grants, Documents){
        $scope.issue = grants.issue;
        
        $scope.ready = function() {
            if (!$scope.issue[0] || !$scope.issue[0].getDocs().grant)
                return false;
            var document = Documents.getOriginal($scope.issue[0].getDocs().grant.doc_id);
            if (document) {
                return document.validTransaction();
            } else {
                return false;
            }
        };
}]);

app.controller('docsGrantIssue',
    ["$scope", "captable", "grants", function($scope, captable, grants) {

        $scope.state = {evidenceQuery: "",
                        originalOnly: true};
        $scope.issue = grants.issue;

        $scope.handleDrop = function(item, bin) {
            $scope.issue[0].addSpecificEvidence(parseInt(item), String(bin), String(bin));
        };
}]);

app.controller('peopleGrantIssue',
    ["$scope", "grants", "Documents", function($scope, grants, Documents){
        $scope.issue = grants.issue;
        
        $scope.ready = function() {
            if (!$scope.issue[0] || !$scope.issue[0].getDocs().grant)
                return false;
            var document = Documents.getOriginal($scope.issue[0].getDocs().grant.doc_id);
            if (!document || !document.validTransaction())
                return false;
            
            for (var e in grants.docsshare.emails)
            {
                if (document.hasInvalidAnnotation(grants.docsshare.emails[e]))
                    return false;
            }
            
            for (var a in document.annotations)
            {
                if (document.annotations[a].required)
                {
                    if (!document.annotations[a].isInvalid())
                        continue;
                    for (var e in grants.docsshare.emails)
                    {
                        if (document.annotations[a].isInvalid(grants.docsshare.emails[e]))
                            return false;
                    }
                }
            }
            return true;
        };
}]);

app.controller('reviewGrantIssue',
    ["$scope", "grants", "$rootScope", "$location", function($scope, grants, $rootScope, $location){
        $scope.send = function() {
            grants.docsshare.shareDocuments().then(function(res) {
                $rootScope.$emit("notification:success", "Options granted!");
                $location.path('/app/company/home'); // TODO: redirect to the grants page, once that page shows in-flight documents (not in the transaction table yet)
            }).catch(function(err) {
                if (err === "Not all documents prepared for all people") {
                    $rootScope.$emit("notification:fail", "Sorry, we couldn't understand some of the document data. Please re-prepare them and recheck the data.");
                } else {
                    $rootScope.$emit("notification:fail", "Oops, something went wrong.");
                }
            });
        };
}]);
