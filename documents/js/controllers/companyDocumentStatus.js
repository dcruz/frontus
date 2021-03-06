//'use strict';

app.controller('CompanyDocumentStatusController', ['$scope', '$routeParams', '$rootScope', '$filter', '$location', 'SWBrijj', 'navState', '$route',
    function($scope, $routeParams, $rootScope, $filter, $location, SWBrijj, navState, $route) {
        if (navState.role == 'investor') {
            $location.path('/investor-list');
            return;
        }

        $scope.signeeded = "No";
        $scope.archivestate = false;

        $scope.toggleArchived = function() {
            $scope.archivestate = !$scope.archivestate;
        };

        SWBrijj.tblm('global.server_time').then(function(time) {
            $rootScope.servertime = time[0].fromnow;
        });

        // Set up event handlers
        $scope.$on('event:loginRequired', function() {
            document.location.href = '/login';
        });
        $scope.$on('event:brijjError', function(event, msg) {
            $rootScope.errorMessage = msg;
        });

        // $scope.$on('$locationChangeSuccess', function(event) {delete $rootScope.errorMessage; });

        var docId = parseInt($routeParams.doc, 10);
        SWBrijj.tblm("document.my_company_library_doc", ['doc_id', 'company', 'docname', 'last_updated', 'uploaded_by', 'pages', 'tags', 'lastedit', 'lastsent'], "doc_id", docId).then(function(data) {
            if (data.tags !== null) data.tags = JSON.parse(data.tags);
            $scope.document = data;
        });

        SWBrijj.tblmm("document.my_counterparty_library", "original", docId).then(function(data) {
            $scope.docversions = data;
            if ($scope.docversions && $scope.docversions[0]) {
                $scope.setLastLogins();
                $scope.setLastDeadline();
            }
        });

        $scope.setLastLogins = function() {
            SWBrijj.tblm("document.user_tracker").then(function (logins) {
                angular.forEach($scope.docversions, function (person) {
                    angular.forEach(logins, function (login) {
                        if (login.email === person.investor) {
                            person.lastlogin = login.logintime;
                        }
                    });
                });
            });
        };

        $scope.activityFeed = "document.company_activity_feed";
        $scope.activityFeedFilter = "original";
        $scope.activityFeedFilterValue = docId;

        $scope.initInfoVar = function(infoVar, eventTime) {
            if(!infoVar || eventTime > infoVar) {infoVar = eventTime;}
        };
        $scope.initLastDeadline = function(act) {
            $scope.initInfoVar($scope.lastdeadline, act.event_time);
        };
        $scope.setLastDeadline = function() {
            var lastdeadline = $scope.docversions[0].signature_deadline;
            for (var i=0; i++; i<$scope.docversions.length-1) {
                if ($scope.docversions[i].signature_deadline > lastdeadline) {
                    lastdeadline = $scope.docversions[i].signature_deadline;
                }
            }
            $scope.lastdeadline = lastdeadline;
        };

        $scope.documentshareOpen = function() {
            $location.path('/company-list?share');
            $location.search({});
        };
        $scope.gotoTag = function(tag) {
            $location.url('/app/documents/company-list?q='+tag);
        };

        $scope.$watch('document.docname', function(newValue, oldValue) {
            if (newValue === "") {
                return "Untitled";
            } else {
                return oldValue;
            }
        });

        $scope.activityOrder = function(card) {
            if (card.activity == "Uploaded by ") {
                return 0;
            } else {
                return -card.event_time;
            }
        };

        $scope.editorEnabled = false;

        $scope.enableEditor = function() {
            $scope.editorEnabled = true;
            $scope.editableTitle = $scope.page_title;
        };

        $scope.disableEditor = function() {
            $scope.editorEnabled = false;
        };

        $scope.save = function() {
            var newname = $scope.editableTitle;
            $scope.page_title = newname;
            $scope.disableEditor();
            SWBrijj.procm("document.title_change", docId, newname).then(function(data) {
            });
        };

        $scope.viewOriginal = function() {
            $location.url("/app/documents/company-view?doc=" + $scope.document.doc_id + "&page=1");
        };

        $scope.viewInvestorCopy = function(investor) {
            $location.url("/app/documents/company-view?doc=" + investor.original + "&page=1" + "&investor=" + investor.doc_id);
        };

        $scope.rejectSignature = function(cd) {
            SWBrijj.procm("document.reject_signature", cd.doc_id).then(function(data) {
                void(data);
                cd.when_signed = null;
                //$scope.$apply();
                $scope.$$childHead.init();
            });
        };

        $scope.formatLastLogin = function(lastlogin) {
            return lastlogin ? "Last Login " + moment(lastlogin).from($rootScope.servertime) : "Never Logged In";
        };

        $scope.formatDate = function(date, fallback) {
            if (!date) {
                return fallback ? fallback : "ERROR";
            } else if (!$rootScope.settings || !$rootScope.settings.dateformat) {
                return "";
            } else {
                return "" + $filter('date')(date, $rootScope.settings.dateformat) + "\n" + $filter('date')(date, 'shortTime');
            }
        };

        $scope.investorOrder = 'investor';

        $scope.setOrder = function(field) {
            $scope.investorOrder = ($scope.investorOrder == field) ? '-' + field : field;
        };

        /*$scope.remind = function(message, email) {
            SWBrijj.procm("document.remind_document", docId, email.toLowerCase(), message).then(function(data) {
            });
        };
        */

        $scope.showStatusDetail = function(person) {
            $scope.docversions.forEach(function(name) {
                if (name === person) name.shown = !name.shown;
                else name.shown = false;
            });
        };

        $scope.reminder = "";

        $scope.opts = {
            backdropFade: true,
            dialogFade: true,
            dialogClass: 'modal wideModal'
        };

        $scope.remmodalUp = function(name) {
            $scope.reminder = name;
            $scope.remModal = true;
        };

        $scope.remclose = function() {
            $scope.remModal = false;
        };

        $scope.remopts = {
            backdropFade: true,
            dialogFade: true
        };


        function failed() {
            alert("failed");
        }

        $scope.shareDocument = function(doc) {
            void(doc);
            $location.url("/app/documents/company-list?share");
        };

        $scope.prepareDocument = function(doc) {
            $location.url("/app/documents/company-view?doc=" + doc.doc_id + "&page=1&prepare=true");
        };
        // Sharing modal functions

        $scope.shareDocOpen = function() {
            $scope.messageText = "Add an optional message...";
            $scope.signeeded = "No";
            $scope.shareDocModal = true;
        };

        $scope.shareDocClose = function() {
            $scope.shareDocModal = false;
            $scope.messageText = "Add an optional message...";
            $scope.signeeded = "No";
        };

        $scope.changeSig = function(value) {
            $scope.signeeded = value;
            if ($scope.messageText==="") {
                $scope.messageText = "Add an optional message...";
            }
        };

    }
]);
