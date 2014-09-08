'use strict';

var service = angular.module('commonServices');

service.service('Message', ['SWBrijj', 'navState', '$q', function(SWBrijj, navState, $q){

    var allUsers = [];
    var allThreads = [];
    var allPeople = [];
    var allEmails = [];
    var allSentThreads = [];

    SWBrijj.tblm('mail.my_messages').then(function(msg){
        angular.forEach(msg, function(ms){
            // allIndThreads.push(ms);
            if(ms.sender == navState.userid){
                allSentThreads.push(ms);
            };
        });
    });

     

    SWBrijj.tblm('global.user_list', ['email', 'name']).then(function(data){
        angular.forEach(data, function(user){
            allUsers.push(user);
      }); 
    }); 


    var getArrayFromPostgres = function(array){
        var array1 = array.replace("{", "");
        var array2 = array1.replace("}", "");
        var array3 = array2.split(",");
        return array3;
    };


    SWBrijj.tblm('mail.my_threads', ['members', 'thread_id', 'subject', 'starts_like']).then(function(data){
        angular.forEach(data, function(thr){
            thr.names = [];
            thr.membersArray = getArrayFromPostgres(thr.members);
            allThreads.push(thr);
        });
        SWBrijj.tblm('global.user_list', ['email', 'name']).then(function(info){
            angular.forEach(info, function(inf){
               allPeople.push(inf);
               if(allEmails.indexOf(inf.email)=== -1){
                    allEmails.push(inf.email);
               }          
            });
            angular.forEach(allThreads, function(thread){
                for(var i = 0; i < thread.membersArray.length; i ++){
                    angular.forEach(allPeople, function(person){
                        if(person.email == thread.membersArray[i] && person.name !== null && thread.membersArray[i]!== navState.userid){
                            thread.names.push(person.name);
                        }
                        else if(thread.membersArray[i]== person.email && person.name == null && thread.membersArray[i]!== navState.userid){
                            thread.names.push(person.email);
                        }
                        else if(thread.membersArray[i]== person.email && person.email == navState.userid && thread.names.indexOf("me")== -1){
                            thread.names.push("me");
                        }
                        else if(allEmails.indexOf(thread.membersArray[i])== -1 && thread.names.indexOf(thread.membersArray[i])== -1){
                            thread.names.push(thread.membersArray[i]);
                        }
                    });
                }
            })
            angular.forEach(allThreads, function(thr){
                thr.nameString = thr.names.join(", ");
            });
        });

    });



    this.getSentMsgs = function(){
        return allSentThreads;
    };

    this.getAllThreads = function(){
        return allThreads;
    };

    this.getAllNames = function(){
        return allUsers;
    };

    this.getAllPeople = function(){
        return allPeople;
    };


    this.getAllEmails = function(){
        return allEmails;
    };

}]);

