'use strict';

app.controller('MsgCtrl', ['$scope', '$rootScope', 'SWBrijj', 'navState', '$route', '$location', '$q', 'Message', '$routeParams', '$timeout',
    function($scope, $rootScope, SWBrijj, navState, $route, $location, $q, Message, $routeParams, $timeout) {

        $scope.page = $routeParams.folder;
        $scope.filterText = $routeParams.q;
        $scope.myMessages = [];
        $scope.allThreads = Message.getAllThreads();
        $scope.myPeople = Message.getAllNames();
        $scope.allPeople = Message.getAllPeople();
        $scope.myRecs = Message.getAllMsgs();

        $scope.togglePage = function(button){
            if($scope.page !== button){
                $scope.page = button;
            }
            else if($scope.page === button){
                $scope.page = null;
            }
            else{
                $scope.page = null;
            }
        };

        $scope.$watch('page', function(new_page, old_page) {
            if (new_page != old_page) {
                $location.search('folder', new_page).replace();
            }
        });

        var searchChangeTimeout;
        $scope.$watch('filterText', function(new_text, old_text) {
            if (searchChangeTimeout) {
                $timeout.cancel(searchChangeTimeout);
            }
            searchChangeTimeout = $timeout(function() {
                if (new_text != old_text) {
                    if (new_text === "") {
                        // delete the term instead of setting it to ""
                        $location.search('q', null).replace();
                    } else {
                        $location.search('q', new_text).replace();
                    }
                }
            }, 100);
            searchChangeTimeout.then(function() {
                searchChangeTimeout = null;
            });
        });

        $scope.gotoCompose = function() {
            $location.url('/app/messages/compose');
        };

        $scope.sortBy = function(col) {
            if ($scope.sort == col) {
                $scope.sort = ('-' + col);
            } else {
                $scope.sort = col;
            }
        };

        $scope.gotoThread = function(thread) {
            $location.url("/app/messages/thread?thread=" + thread);
        };

        $scope.today = function() {
            return Math.floor(Date.now() / 86400000)*86400000;
        };

        $scope.getThread = function(elem){
            $scope.myThread = elem;
        };
    }
]);

app.controller('threadCtrl', ['$scope', '$rootScope', 'SWBrijj', 'navState', '$route', '$location', '$routeParams', '$q', 'Message',
    function($scope, $rootScope, SWBrijj, navState, $route, $location, $routeParams, $q, Message) {
        $scope.threadId = parseInt($routeParams.thread);

        $scope.getPeopleNames = function(){
            var promise = $q.defer();
            SWBrijj.tblm('mail.my_thread_members', ['user_id', 'name']).then(function(data){
                $scope.myPeople = data;
                $scope.peopleDict = {};
                angular.forEach($scope.myPeople, function(person){
                    if (person.user_id == navState.userid)
                        $scope.peopleDict[person.user_id] = "me";
                    else
                        $scope.peopleDict[person.user_id] = person.name;
                });
                promise.resolve($scope.peopleDict);
            });
            return promise.promise;
        };

        $scope.getMessages = function(){
            SWBrijj.tblmm('mail.my_messages', 'thread_id', $scope.threadId).then(function(data){
                $scope.getPeopleNames().then(function(){
                    $scope.myThreads = data;
                    angular.forEach($scope.myThreads, function(thread){
                        thread.senderName = $scope.peopleDict[thread.sender];
                        if(!thread.senderName){
                            thread.senderName = thread.sender;
                        }
                        thread.members = JSON.parse(thread.members);
                        thread.recipients = [];
                        angular.forEach(thread.members, function(member){
                            if (member != thread.sender)
                            if ($scope.peopleDict[member]) {
                                thread.recipients.push($scope.peopleDict[member]);
                            } else {
                                thread.recipients.push(member);
                            }

                        });
                        thread.recipientsString = thread.recipients.join(", ");
                    });
                });
            });
        };
        $scope.getMessages();

        $scope.readyToSend = function(msg){
            if(msg.text ===""){
                return false;
            }
            else{
                return true;
            }
        };

        $scope.message = {};
        $scope.replyMessage = function(msg){
            var msgInfo = $scope.myThreads[0];
            var category = 'company-message';
            var template = 'company-message.html';
            var newtext = msg.text.replace(/\n/g, "<br/>");
            SWBrijj.procm('mail.send_message',
                null,
                msgInfo.thread_id,
                'Re: ' + msgInfo.subject,
                newtext,
                null
            ).then(function(x) {
                void(x);
                $location.url('/app/messages/');
                Message.refresh();
                $scope.clicked = false;
            }).except(function(err) {
                void(err);
                $rootScope.$emit("notification:fail",
                    "Oops, something went wrong.");
                $scope.clicked = false;
            });

        };

         $scope.getPhotoUrl = function(sender){
                if(sender == navState.userid){
                    return '/photo/user?id=' + sender;
                }
                else {
                    return '/photo/user?id=thread_profile:' + sender;
                }
            };


    }
]);
