'use strict';

app.controller('ContactCtrl',
    ['$scope', '$rootScope', 'SWBrijj', '$routeParams',
    function($scope, $rootScope, SWBrijj, $routeParams) {
        function getCanvasOffset(ev) {
            var offx, offy;
            if (ev.offsetX === undefined) { // Firefox code
                offx = ev.layerX-ev.target.offsetLeft;
                offy = ev.layerY-ev.target.offsetTop;
            } else {
                offx = ev.offsetX;
                offy = ev.offsetY;
            }
            return [offx, offy];
        }
        if ($routeParams.verificationCode) {
            SWBrijj.procm('account.verify_email', $routeParams.verificationCode)
            .then(function(res) {
                    console.log(res);
                if (res[0].verify_email) {
                    angular.forEach($scope.emails, function(email) {
                        if (email.email == res[0].verify_email) {
                            email.verified = true;
                        }
                    });
                    $scope.$emit("notification:success", "Email address verified.");
                } else {
                    $scope.$emit("notification:fail", "Failed to verify alternate email address.");
                }
            }).except(function(err) {
                console.log(err);
                $scope.$emit("notification:fail", "Failed to verify alternate email address.");
            });
        }

        $scope.pictureModalOpen = function() {
            $scope.pictureModal = true;
        };

        $scope.pictureModalClose = function() {
            $scope.files = [];
            $scope.closeMsg = 'I was closed at: ' + new Date();
            $scope.pictureModal = false;
        };

        $scope.passwordModalOpen = function() {
            $scope.passwordModal = true;
        };

        $scope.passwordModalClose = function() {
            $scope.closeMsg = 'I was closed at: ' + new Date();
            $scope.passwordModal = false;
            $scope.currentPassword = "";
            $scope.newPassword = "";
            $scope.passwordConfirm = "";
        };

        // Password code
        $scope.currentPassword = "";
        $scope.newPassword = "";
        $scope.passwordConfirm = "";

        $scope.validPasswordNot = function() {
            return !($scope.currentPassword && $scope.passwordMatches());
            // return !($scope.currentPassword && !($scope.passwordMatchesNot() || $scope.regexPassword())); };
        };

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
            return $scope.passwordConfirm && $scope.newPassword && $scope.passwordConfirm == $scope.newPassword;
        };

        $scope.changePassword = function() {
            SWBrijj.proc("account.change_password", $scope.currentPassword, $scope.newPassword).then(function(x) {
                if (x[1][0]) {
                    $scope.$emit("notification:success", "Your password has been updated successfully.");
                    // console.log("changed successfully");
                } else {
                    $scope.$emit("notification:fail", "There was an error updating your password.");
                    // console.log("Oops.  Change failed");
                    $scope.currentPassword = "";
                    $scope.newPassword = "";
                    $scope.passwordConfirm = "";
                }
            }).except(function(x) {
                console.error("Oops.  Change failed: " + x);
            });
        };

        $scope.profileModalOpen = function() {
            $scope.profileModal = true;
            $scope.editData = {'name': angular.copy($scope.name),
                               'street': angular.copy($scope.street),
                               'city': angular.copy($scope.city),
                               'state': angular.copy($scope.state),
                               'postalcode': angular.copy($scope.postalcode)};
        };
        $scope.profileModalClose = function() {
            $scope.profileModal = false;
            $scope.editData = null;
        };

        $scope.profilecheck = {};
        $scope.profileCheck = function (attr, value) {
            $scope.profilecheck[attr] = value;
        };

        $scope.profileUpdate = function(attr, value) {
            if ($scope.profilecheck[attr] != value && value !== undefined) {
                SWBrijj.proc("account.contact_update", attr, value).then(function(x) {
                    $scope.$emit("notification:success", "Profile successfully updated");
                    if (attr == 'name') {
                        $rootScope.person.name = value;
                    }
                    $scope[attr] = value;
                    $scope.profileCheck(attr, value);
                }).except(function(x) {
                    $scope.$emit("notification:fail", "Something went wrong, please try again later");
                });
            }
        };

        $scope.attributeUpdate = function(attribute, value) {
            if ($scope.profilecheck[attribute] != value && value !== undefined) {
                SWBrijj.procm("smartdoc.update_investor_attributes", attribute, value).then(function(x) {
                    $scope.investor_attributes[attribute][0] = value;
                    $scope.$emit("notification:success", "Profile successfully updated");
                }).except(function(err) {
                });
            };
        };

        $scope.profileopts = {
            backdropFade: true,
            dialogFade:true,
            dialogClass: 'profile-modal wideModal modal'
        };

        $scope.opts = {
            backdropFade: true,
            dialogFade: true
        };

        $scope.address1 = function() {
            return $scope.street;
        };
        $scope.address2 = function() {
            if ($scope.city && $scope.state && $scope.postalcode) {
                return $scope.city + ", " + $scope.state + " " + $scope.postalcode;
            } else if ($scope.city || $scope.state) {
                return ($scope.city || "") + ($scope.state || "") + " " + ($scope.postalcode || "");
            } else if ($scope.postalcode) {
                return $scope.postalcode;
            } else {
                return null;
            }
        };

        $scope.getInvestorInformation = function() {
            SWBrijj.tblm('smartdoc.my_profile').then(function(data) {
                // Imports the investor attributes
                $scope.investor_attributes = {};
                angular.forEach(data, function(attr) {
                    $scope.investor_attributes[attr.attribute] = [attr.answer, attr.label];
                });
            }).except(function(err) {
                console.log(err);
            });
        };

        /** initPage
         * @param $scope
         * @param x
         * @param {number} [row]
         */

        function initPage($scope, x) {
            var y = x[0]; // the fieldnames
            var z = x[1]; // the values

            for (var i = 0; i < y.length; i++) {
                if (z[i] !== null) {
                    $scope[y[i]] = z[i];
                }
            }
        }

        /** @name SWBrijj#tbl
         * @function
         * @param {string} table_name */
        SWBrijj.tbl('account.profile').then(function(x) {
            initPage($scope, x);
            $scope.profileCheck('primary_email', $scope.primary_email); // needed since it's not an input
            $scope.photoURL = '/photo/user?id=' + $scope.user_id;
            var randnum = Math.random();
            $scope.signatureURL = '/photo/user?id=signature:&dontcache=' + randnum;
            $scope.namekey = $scope.name;
            $scope.getInvestorInformation();
        }).except(function(err) {
            document.location.href = '/login';
        });



        $scope.emails = [];
        var primeEmail = "";

        SWBrijj.tblm('account.my_emails').then(function(returned_emails) {
            returned_emails.forEach(function (e) {
                e.key = e.email;
                $scope.emails.push(e);
                e.primary = false;
                if (e.email == $scope.primary_email) {
                    e.primary = true;
                }
            });
            angular.forEach($scope.emails, function(email){
                if(email.email==$scope.primary_email){
                    primeEmail = email;
                }
            });
            $scope.emails.sort(primarySort);
        });

        function primarySort(a,b) {
            if (a.primary)
                return -1;
            else if (b.primary)
                return 1;
            else
                return 0;
        }

        $scope.uploadFile = function() {
            $scope.photoURL = "/img/image-loader-140.gif";
            var fd = new FormData();
            $scope.progressVisible = true;
            for (var i = 0; i < $scope.files.length; i++) fd.append("uploadedFile", $scope.files[i]);

            /** @name SWBrijj#uploadImage
             * @function
             * @param {FormData}
             */
            SWBrijj.uploadImage(fd).then(function(x) {
                void(x);
                // console.log(x);
                $scope.$emit("notification:success", "Profile photo successfully updated");
                $scope.photoURL = '/photo/user?id=' + $scope.user_id + '#' + new Date().getTime();
                $rootScope.userURL = '/photo/user?id=' + $scope.user_id + '#' + new Date().getTime();
            }).except(function(x) {
                void(x);
                // console.log(x);
                $scope.$emit("notification:fail", "Profile photo change was unsuccessful, please try again.");
                $scope.photoURL = '/photo/user?id=' + $scope.user_id + '#' + new Date().getTime();
            });
        };

        $scope.setFiles = function(element) {
            $scope.files = [];
            for (var i = 0; i < element.files.length; i++) {
                $scope.files.push(element.files[i]);
                $scope.$apply();
            }
        };
        
        $scope.uploadSuccess = function() {
            var randnum = Math.random();
            $scope.signatureURL = '/photo/user?id=signature:&dontcache=' + randnum;
            $scope.signatureprocessing = false;
            $scope.progressVisible = false;
            $scope.signaturepresent = true;
            var elements = document.getElementsByClassName('draggable imagesignature mysignature');
            angular.forEach(elements, function(element) {
                element = element.querySelector("textarea");
                if (element.style.backgroundImage == 'url(/photo/user?id=signature:)') {
                    element.style.backgroundImage = 'url(/photo/user?id=signature:1)';
                }
                else {
                    element.style.backgroundImage = 'url(/photo/user?id=signature:)';
                }
            });
            $scope.$emit("notification:success", "Signature uploaded");
            $scope.scribblemode = false;
            $scope.$apply();
        };

        $scope.uploadFail = function() {
            $scope.progressVisible = false;
            $scope.signatureprocessing = false;
            var randnum = Math.random();
            $scope.signatureURL = '/photo/user?id=signature:&dontcache=' + randnum;
            $scope.$emit("notification:fail", "Oops, something went wrong.");
        };
        
        $scope.sigOptions = { open: false,
                            successCallback: $scope.uploadSuccess,
                            failureCallback: $scope.uploadFail };

        $scope.sigModalUp = function () {
            //$scope.signaturestyle = {height: String(180), width: String(330) };
            //$scope.signatureModal = true;
            console.log("up");
            $scope.sigOptions.sigURL = $scope.signatureURL;
            $scope.sigOptions.open = true;
        };

        $scope.sigclose = function () {
            //$scope.signatureModal = false;
            //$scope.scribblemode = false;
            $scope.sigOptions.open = false;
        };

        $scope.touropts = {
            backdropFade: true,
            dialogFade: true,
            dialogClass: 'helpModal modal'
        };

        var emailRegExp = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

        $scope.emailCheck = function(email) {
            return !(email && emailRegExp.test(email));
        };

        $scope.addEmail = function(email) {
            if (!email) {
                return;
            }
            SWBrijj.insert('account.my_emails', {user_id: $scope.user_id, email: email}).then(function(res) {
                $scope.emails.push({email: email, verified: false, user_id: $scope.user_id});
                $scope.$emit("notification:success", "Email added. We've sent you an email to verify ownership");
                // TODO: notification:success and call verification flow;
                $scope.newEmail = "";
            }).except(function(err) {
                console.error(err);
                $scope.$emit("notification:fail", "Sorry, we were unable to add " + email + ".");
            });
        };

        $scope.removeEmail = function(email) {
            SWBrijj.delete_one('account.my_emails', {user_id: email.user_id, email: email.email}).then(function(res) {
                var ix = $scope.emails.indexOf(email);
                $scope.emails.splice(ix, 1);
                $scope.$emit("notification:success", "Email removed");
            }).except(function(err) {
                console.error(err);
                $scope.$emit("notification:fail", "Sorry, we were unable to remove " + email.email + ". Please try again later.");
            });
        };

        $scope.updateEmail = function(email) {
            console.log(email);
            SWBrijj.update('account.my_emails', {email: email.email}, {user_id: email.user_id, email: email.key}).then(function(res) {
                email.key = email.email;
                $scope.$emit("notification:success", "Check ");
            }).except(function(err) {
                console.error(err);
                $scope.$emit("notification:fail", "Sorry, we were unable to change " + $scope.profilecheck.workingEmail + ".");
                email.email = $scope.profilecheck.workingEmail;
            });
        };

        $scope.reverifyEmail = function(email) {
            // TODO
        };
    }
]);
