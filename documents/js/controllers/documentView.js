'use strict';

app.controller('DocumentViewController', ['$scope', '$rootScope', '$compile', '$location', '$routeParams', '$window', 'SWBrijj', 'Annotations', 'Documents', 'User',
    function($scope, $rootScope, $compile, $location, $routeParams, $window, SWBrijj, Annotations, Documents, User) {
        $scope.annots = [];
        $scope.signatureprocessing = false;

        $scope.$watch('docId', function(new_doc_id) {
            $scope.doc = Documents.getDoc(new_doc_id); // gets blank doc for now ...
        });

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

        $scope.image = {width: 0, height: 0};
        $scope.dp = {width: 0, height: 0};
        $scope.updateDocPanelSize = function() {
            var dp = $('.docPanel');
            if (dp) {
                dp.height((dp.width()/$scope.image.width)*$scope.image.height);
                $scope.dp.width = dp.width();
                $scope.dp.height = dp.height();
            }
        };
        $scope.$watchCollection('image', $scope.updateDocPanelSize);
        window.onresize = $scope.updateDocPanelSize;
        $window.onkeydown = function(evt) {
            // TODO: evt.which is read-only ("TypeError: setting a property that has only a getter")
            var ev = evt.which || e.keyCode;
            // Need the extra if so that the page change doesn't occur if you are currently focused into a sticky
            if (document.activeElement.tagName.toLowerCase() != 'textarea' ) {
                $scope.$apply(function() {
                    if (ev === 37) {
                        $scope.previousPage($scope.doc.currentPage);
                    } else if (ev === 39) {
                        $scope.nextPage($scope.doc.currentPage);
                    }
                });
            }
        };
        // Tells JS to update the backgroundImage because the imgurl has changed underneath it.
        var refreshDocImage = function() {
            var docpanel = document.querySelector(".docPanel");
            if (docpanel) {
                var imgurl;
                imgurl = docpanel.style.backgroundImage;
                docpanel.style.backgroundImage = imgurl;
                var img = new Image();
                img.onload = function() {
                    $scope.$apply(function() {
                        $scope.image.width = img.width;
                        $scope.image.height = img.height;
                        $scope.updateDocPanelSize();
                    });
                };
                img.src = $scope.pageImageUrl();
            }
        };

        $scope.$on('initDocView', function(event, docId, invq, library, pageQueryString, pages) {
            if (!docId) return;
            $scope.docId = docId;
            $scope.invq = invq;
            $scope.library = library;
            $scope.pageQueryString = pageQueryString;
            $scope.pages = pages;
            $scope.template_original = false;
            refreshDocImage();
            $scope.loadPages();
        });

        $scope.get_attribute = function(attribute, type, attributes) {
            if (type == "company") {
                if (attribute == "companyName") {
                    return attributes.name;
                }
                else if (attribute == "companyState") {
                    return attributes.state;
                }
            }
        };

        var regExp = /\(([^)]+)\)/;
        $scope.template_share = function(email, attributes, message, sign, deadline) {
            $scope.processing = true;
            var shareto = "";

            angular.forEach(email, function(person) {
                var matches = regExp.exec(person);
                if (matches === null) {
                    matches = ["", person];
                }
                shareto += "," +  matches[1];
            });

            SWBrijj.smartdoc_share_template($scope.templateKey, JSON.stringify(attributes), shareto.substring(1).toLowerCase(), message, sign, deadline).then(function(docid) {
                $scope.$emit("notification:success", "Successfully shared document");
                $location.path('/company-list').search({});
            }).except(function(err) {
                $scope.processing = false;
                console.log(err);
            });
        };

        $scope.signTemplate = function(attributes, saved, signed) {
            // This is hideous and can go away when the user profile is updated at the backend
            $scope.processing = true;
            var cleanatt = {};
            for (var key in attributes) {
                if (key == 'investorName') {
                    cleanatt.name = attributes[key];
                }
                else if (key == 'investorState') {
                    cleanatt.state = attributes[key];
                }
                else if (key == 'investorCountry') {
                    cleanatt.country = attributes[key];
                }
                else if (key == 'investorAddress') {
                    cleanatt.street = attributes[key];
                }
                else if (key == 'investorPhone') {
                    cleanatt.phone = attributes[key];
                }
                cleanatt[key] = attributes[key];
            }
            attributes = JSON.stringify(cleanatt);
            SWBrijj.smartdoc_investor_sign_and_save($scope.subId, $scope.templateId, attributes, saved).then(function(meta) {
                $scope.$emit("notification:success", "Signed Document");
                $location.path('/investor-list').search({});
            }).except(function(err) {
                $scope.processing = false;
                $scope.$emit("notification:fail", "Oops, something went wrong. Please try again.");
                console.log(err);
            });
        };


        $scope.$on('initTemplateView', function(event, templateId, subId) {
            $scope.templateId = templateId;
            $scope.isAnnotable = false;
            $scope.docLength = 0;
            $scope.template_original = true;
            $scope.used_attributes = {};
            $scope.template_email = [];

            SWBrijj.tblmm('smartdoc.document','template_id', $scope.templateId).then(function(meta) {
                $scope.lib = {};
                $scope.lib.docname = meta[0].template_name;
            });

            if ($rootScope.navState.role == "issuer") {
                SWBrijj.smartdoc_render_template($scope.templateId).then(function(raw_html) {
                    SWBrijj.procm('smartdoc.template_attributes', $scope.templateId).then(function(attributes) {
                        var attributes = attributes;
                        SWBrijj.tblm('account.my_company').then(function(company_info) {
                            $scope.company_info = company_info[0];

                            //Sort through all the !!! and make the appropriate replacement
                            // TODO: move to handlebars syntax and compile the doc
                            while (raw_html.match(/!!![^!]+!!!/g)) {
                                var thing = raw_html.match(/!!![^!]+!!!/);
                                thing = thing[0].substring(3,(thing[0].length)-3);
                                var replace = "";
                                angular.forEach(attributes, function (attribute) {
                                    if (thing == attribute.attribute ) {
                                        var first = thing.substring(0,7);
                                        if (first == "company") {
                                            var max_length = "";
                                            var extra_class = "";
                                            if (attribute.max_length) {
                                                max_length = " maxlength=" + attribute.max_length;
                                                extra_class = " length" + attribute.max_length;
                                            }

                                            replace = $scope.get_attribute(attribute.attribute, "company", $scope.company_info);
                                            $scope.used_attributes[attribute.attribute] = replace;
                                            replace = "<span class='template-label'>" +attribute.label + "</span><input class='"+ extra_class +"'" + max_length + " type='text' ng-model='$parent.used_attributes." + attribute.attribute + "'>";
                                        }
                                        else {
                                            if (attribute.attribute_type == "text") {
                                                replace = "<span class='template-label'>" +attribute.label + "</span><input disabled type='text'>";
                                            }
                                            else if (attribute.attribute_type == "check-box") {
                                                replace = "<button disabled type='text' ng-class='{\"selected\":" + attribute.attribute +"==true}' class='check-box-button'></button>";
                                            }
                                            else if (attribute.attribute_type == "textarea") {
                                                replace = "<textarea placeholder='" + attribute.label +"' disabled></textarea>";
                                            }
                                        }
                                    }
                                });
                                raw_html = raw_html.replace(/!!![^!]+!!!/, replace);
                            }
                            $scope.html = raw_html;
                        });
                    });
                });
            }
            else {
                $scope.forsigning = true;
                SWBrijj.smartdoc_render_investor_template($scope.subId).then(function(raw_html) {
                    SWBrijj.procm('smartdoc.template_attributes', $scope.templateId).then(function(attributes) {
                        SWBrijj.tblm('smartdoc.my_profile').then(function(inv_attributes) {
                            // TODO: use information from Annotations service for investor_attributes
                            $scope.investor_attributes = {};
                            angular.forEach(inv_attributes, function(attr) {
                                $scope.investor_attributes[attr.attribute] = attr.answer;
                            });
                            $scope.investor_attributes.investorName = angular.copy($rootScope.person.name);
                            $scope.investor_attributes.investorState = angular.copy($rootScope.person.state);
                            $scope.investor_attributes.investorAddress = angular.copy($rootScope.person.street);
                            $scope.investor_attributes.investorPhone = angular.copy($rootScope.person.phone);
                            $scope.investor_attributes.investorEmail = angular.copy($rootScope.person.email);
                            $scope.investor_attributes.signatureDate = moment(Date.today()).format($rootScope.settings.lowercasedate.toUpperCase());

                            //Sort through all the !!! and make the appropriate replacement
                            while (raw_html.match(/!!![^!]+!!!/g)) {
                                var thing = raw_html.match(/!!![^!]+!!!/);
                                thing = thing[0].substring(3,(thing[0].length)-3);
                                var replace = "";
                                angular.forEach(attributes, function (attribute) {
                                    if (thing == attribute.attribute ) {
                                        var first = thing.split("_")[0];

                                        if (first != "company") {

                                            var max_length = "";
                                            var extra_class = "";
                                            if (attribute.max_length) {
                                                max_length = " maxlength=" + attribute.max_length;
                                                extra_class = " length" + attribute.max_length;
                                            }

                                            if (attribute.attribute_type == "text") {
                                                replace = "<span class='template-label'>" +attribute.label + "</span><input class='"+ extra_class +"'" + max_length + " type='text' ng-model='$parent.investor_attributes." + attribute.attribute + "'>";
                                            }
                                            else if (attribute.attribute_type == "check-box") {
                                                replace = "<button type='text' ng-click=\"$parent.booleanUpdate('"+attribute.attribute+"',$parent.investor_attributes."+ attribute.attribute +")\" ng-class=\"{'selected':$parent.investor_attributes." + attribute.attribute +"=='true'}\" ng-model='$parent.investor_attributes." + attribute.attribute + "' class='check-box-button check-box-attribute'><span data-icon='&#xe023;' aria-hidden='true'></span></button>";
                                            }
                                            else if (attribute.attribute_type == "textarea") {
                                                replace = "<span class='template-label'>" +attribute.label + "</span><textarea ng-model='$parent.investor_attributes." + attribute.attribute + "'></textarea>";
                                            }
                                        }
                                    }
                                });
                                raw_html = raw_html.replace(/!!![^!]+!!!/, replace);
                            }
                            $scope.html = raw_html;
                        });
                    });
                });
            }
        });

        if (!$scope.rejectMessage) {$scope.rejectMessage = "Explain the reason for rejecting this document.";}
        $scope.pageScroll = 0;
        $scope.isAnnotable = true;

        $scope.signatureURL = '/photo/user?id=signature:';

        $scope.annotable = function() {
            return ($scope.invq && $scope.investorCanAnnotate()) || (!$scope.invq && $scope.issuerCanAnnotate());
        };

        $scope.investorCanAnnotate = function() {
            return (!$scope.lib.when_signed && $scope.lib.signature_deadline && $scope.lib.signature_flow===2);
        };

        $scope.issuerCanAnnotate = function() {
            return (!$scope.lib.when_countersigned && $scope.lib.when_signed && $scope.lib.signature_flow===2) ||
                   ($scope.lib && $scope.prepare);
        };

        $scope.resetMsg = function() {
            if ($scope.rejectMessage === "Explain the reason for rejecting this document.") {
                $scope.rejectMessage = "";
            }
        };

        $scope.voidAction = function(confirm, message) {
            $scope.processing = true;
            if (message == "Explain the reason for rejecting this document.") {
                message = " ";
            }
            SWBrijj.document_investor_void($scope.docId, confirm, message).then(function(data) {
                if (confirm == 1) {
                    $scope.$emit("notification:success", "Void request accepted and document voided");
                }
                else {
                    $scope.$emit("notification:success", "Void request rejected");
                }
                $scope.leave();
            }).except(function(x) {
                console.log(x);
                $scope.$emit("notification:fail", "Oops, something went wrong.");
                $scope.processing = false;
            });
        };

        $scope.$emit('docViewerReady');

        $scope.loadPages = function () {
            /** @name SWBrijj#tblmm * @function
             * @param {string}
             * @param {...}
             */
            SWBrijj.tblmm($scope.pages, ['page'], "doc_id", $scope.docId).then(function(data) {
                $scope.doc.pages = data;
                $scope.docLength = data.length;
                loadAnnotations();
            });
        };

        $scope.pageImageUrl = function() {
            if ($scope.pageQueryString && $scope.doc && $scope.doc.currentPage) {
                return "/photo/docpg?" + $scope.pageQueryString + "&page=" + $scope.doc.currentPage;
            } else {
                return '';
            }
        };

        $scope.uploadSuccess = function() {
            $scope.signatureURL = '/photo/user?id=signature:';
            $scope.signatureprocessing = false;
            $scope.progressVisible = false;
            User.signaturePresent = true;
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
            void(0);
            $scope.progressVisible = false;
            $scope.signatureprocessing = false;
            $scope.signatureURL = '/photo/user?id=signature:';
            $scope.$emit("notification:fail", "Oops, something went wrong.");
            // console.log(x);
        };

        $scope.uploadSignatureNow = function() {
            if ($scope.files || $scope.scribblemode) {
                $scope.signatureURL = "/img/image-loader-140.gif";
                $scope.signatureprocessing = true;
                $scope.progressVisible = true;
                var fd;
                if ($scope.scribblemode) {
                    var canvas = document.getElementById("scribbleboard");
                    fd = canvas.toDataURL();
                    $scope.signatureModal = false;
                    SWBrijj.uploadSignatureString(fd).then(function(x) {
                        $scope.uploadSuccess();
                    }).except(function(x) {
                            $scope.uploadFail();
                        });
                }
                else {
                    fd = new FormData();
                    for (var i = 0; i < $scope.files.length; i++) {
                        fd.append("uploadedFile", $scope.files[i]);
                    }
                    $scope.signatureModal = false;
                    SWBrijj.uploadSignatureImage(fd).then(function(x) {
                        $scope.uploadSuccess();
                    }).except(function(x) {
                        $scope.uploadFail();
                    });
                }
            }
            else {
                $scope.signatureModal = false;
            }

        };

        $scope.createNewSignature = function() {
            $scope.scribblemode = true;

            var canvas = document.getElementById("scribbleboard");

            var ctx = canvas.getContext('2d');
            canvas.height = 180;
            canvas.width = 330;
            console.log(ctx);
            console.log(canvas);
            ctx.lineCap = 'round';
            ctx.color = "blue";
            ctx.lineWidth = 2;
            ctx.fillStyle = "white";
            // ctx.setAlpha(0);
            ctx.fillRect(0, 0, 200, 200);
            // ctx.setAlpha(0.5);

            canvas.addEventListener('mousedown', function(e) {
                canvas.down = true;
                var offs = getCanvasOffset(e);
                canvas.X = offs[0];
                canvas.Y = offs[1];
            }, false);

            canvas.addEventListener('mouseover', function(e) {
                void(e);
                canvas.down = false;
            });

            canvas.addEventListener('mouseout', function(e) {
                void(e);
                canvas.down = false;
            });

            canvas.addEventListener('mouseup', function(e) {
                void(e);
                canvas.down = false;
            });

            canvas.strokes = [];

            canvas.addEventListener('mousemove', function(e) {
                if (canvas.down) {
                    ctx.beginPath();
                    ctx.moveTo(canvas.X, canvas.Y);
                    var offs = getCanvasOffset(e);
                    ctx.lineTo(offs[0], offs[1]);
                    canvas.strokes.push([canvas.color, canvas.X, canvas.Y, offs[0], offs[1]]);
                    ctx.stroke();
                    canvas.X = offs[0];
                    canvas.Y = offs[1];
                }
            }, true);
        };

        $scope.setFiles = function(element) {
            $scope.files = [];
            for (var i = 0; i < element.files.length; i++) {
                $scope.files.push(element.files[i]);

                var oFReader = new FileReader();
                oFReader.readAsDataURL($scope.files[0]);

                oFReader.onload = function (oFREvent) {
                    document.getElementById("signaturevisual").src = oFREvent.target.result;
                };
                $scope.scribblemode = false;
                $scope.$apply();
            }
        };

        function loadAnnotations() {
            /** @name SWBrijj#tblm
             * @function
             * @param {string}
             * @param {...}
             */
             SWBrijj.tblm($scope.library, "doc_id", $scope.docId).then(function(data) {
                 if ($scope.lib && $scope.lib.annotations && $scope.lib.annotations.length > 0) {
                     // don't load annotations twice
                     return;
                 }
                 $scope.lib = data;
                 // TODO: migrate all uses of $scope.lib to $scope.doc
                 $scope.doc = Documents.setDoc($scope.docId, data); // save the doc so others can see it
                 $scope.isAnnotable = $scope.annotable(); // requires $scope.lib

                 // TODO: move all of this to the Documents and Annotations services
                 if ($scope.lib.annotations) {
                     // restoreNotes
                     var annots = [];
                     // TODO: should probably load all annotations into $scope.annots, and only display as relevant (probably already works)
                     if ($scope.doc.countersignable($rootScope.navState.role) && $scope.lib.iss_annotations) {
                         // if we're receiving this back from the recipient, only show my annotations (all others stamped?)
                         var temp_annots = JSON.parse($scope.lib.iss_annotations);
                         temp_annots.forEach(function(annot) {
                             // TODO: we're creating an Annotation object and destroying it for no good reason
                             var tmp = new Annotation().parseFromJson(annot);
                             if (tmp.isCountersign()) {
                                 annots.push(annot);
                             }
                         });
                     } else {
                         if ($scope.drawTime()) { // if it's not drawTime or counterSigntime, then there should be no annotations anywhere
                             annots = JSON.parse($scope.lib.annotations);
                             if (data.iss_annotations) {
                                 annots = annots.concat(JSON.parse(data.iss_annotations));
                             }
                         };
                     }
                     $scope.annots = Annotations.setDocAnnotations($scope.docId, annots);
                     var sticky;
                     for (var i = 0; i < annots.length; i++) {
                         var annot = annots[i];
                     }
                 } else {
                     // ensure annotations are linked to the service even if we didn't fetch any
                     $scope.annots = Annotations.getDocAnnotations($scope.docId);
                 }
             }).except(function(err) {
                 $scope.leave();
             });
        }


        $window.addEventListener('beforeunload', function(event) {
            void(event);
            if (document.location.href.indexOf('-view') != -1) {
                var ndx_inv = JSON.stringify(Annotations.getInvestorNotesForUpload($scope.docId));
                var ndx_iss = JSON.stringify(Annotations.getIssuerNotesForUpload($scope.docId));
                /** @name $scope#lib#annotations
                 * @type {[Object]}
                 */
                /*
                 if ((!$scope.lib) || ndx == $scope.lib.annotations || !$scope.isAnnotable){
                 console.log("OH NO!!!");
                 return; // no changes
                 }
                 */

                /** @name SWBrijj#_sync
                 * @function
                 * @param {string}
                 * @param {string}
                 * @param {string}
                 * @param {...}
                 */
                // This is a synchronous save
                /** @name $scope#lib#original
                 * @type {int} */
                if (!$scope.template_original && !$scope.templateId && $scope.lib && $scope.isAnnotable && !$scope.doc.countersignable($rootScope.navState.role)) {
                    var res = SWBrijj._sync('SWBrijj', 'saveNoteData', [$scope.docId, $scope.invq, !$scope.lib.original, ndx_inv, ndx_iss]);
                    if (!res) alert('failed to save annotations');
                }
                // TODO: should call saveSmartdocData
                if ($scope.template_original && $scope.prepareable($scope.lib)) {
                    var res2 = SWBrijj._sync('SWBrijj', 'proc',
                        ["account.company_attribute_update",
                            "name",
                            $scope.used_attributes.companyName
                        ]
                    );
                    var res3 = SWBrijj._sync('SWBrijj', 'proc',
                        ["account.company_attribute_update",
                            "state",
                            $scope.used_attributes.companyState
                        ]
                    );
                    if (!res2 || !res3) alert('failed to save annotations');
                }
            }

        });

        /* Save the notes when navigating away */
        // There seems to be a race condition with using $locationChangeStart or Success
        $scope.$on('$locationChangeStart', function(event, newUrl, oldUrl) {
            void(oldUrl);
            // don't save note data if I'm being redirected to log in
            if (newUrl.match(/login([?]|$)/)) return;
            $scope.saveNoteData();
            $scope.saveSmartdocData();
        });

        $scope.$on('event:leave', $scope.leave);

        $scope.leave = function() {
            if ($rootScope.lastPage &&
                ($rootScope.lastPage.indexOf("/register/") === -1) &&
                ($rootScope.lastPage.indexOf("/login/") === -1) &&
                ($rootScope.lastPage.indexOf("-view") === -1)) {
                if (document.location.href.indexOf("share=true") !== -1) {
                    sessionStorage.setItem("docPrepareState",
                            angular.toJson({template_id: $scope.templateId,
                                            doc_id: $scope.docId}));
                    $rootScope.lastPage = $rootScope.lastPage + "?share";
                }
                if ($rootScope.lastPage.indexOf("company-status") !== -1) {
                    $rootScope.lastPage = $rootScope.lastPage + "?doc=" + $scope.docKey;
                }
                $location.url($rootScope.lastPage);
            } else if ($scope.invq) {
                $location.url('/app/documents/investor-list');
            } else {
                $location.url('/app/documents/company-list');
            }
        };

        $scope.safeApply = function(fn) {
            var phase = this.$root.$$phase;
            if (phase === '$apply' || phase === '$digest') {
                if(fn && (typeof(fn) === 'function')) {
                    fn();
                }
            } else {
                this.$apply(fn);
            }
        };

        $scope.$watch('doc.currentPage', function(page) {
            if (page) {
                var s = $location.search();
                s.page = page;
                $location.search(s);
                scroll(0,0);
                refreshDocImage();
            }
        });

        $scope.nextPage = function(value) {
            if ($scope.doc.currentPage < $scope.docLength) {
                $scope.doc.currentPage += 1;
            }
        };

        $scope.previousPage = function(value) {
            if ($scope.doc.currentPage > 1) {
                $scope.doc.currentPage -= 1;
            }
        };

        $scope.newnewBox = function(event) {
            if ($scope.isAnnotable && (!$scope.lib.when_shared && $rootScope.navState.role == "issuer") || (!$scope.lib.when_signed && $scope.lib.signature_flow > 0 &&  $rootScope.navState.role == "investor")) {
                var a = new Annotation();
                a.page = $scope.doc.currentPage;
                a.position.docPanel = $scope.dp;
                a.position.size.width = 0;
                a.position.size.height = 0;
                a.initDrag = event;
                if ($rootScope.navState.role == "issuer") {
                    a.investorfixed = true;
                } else {
                    a.investorfixed = false;
                }
                $scope.annots.push(a);
            }
        };

        /*
        function newBoxX(annot) {
            bb.addEventListener('mousemove', function(e) {
                if (e.which !== 0) {
                    boundBoxByPage(bb); // TODO?
                }
            });
        }*/

        $scope.acceptSign = function(sig) {
            void(sig);
            SWBrijj.procm("document.countersign", $scope.docId).then(function(data) {
                void(data);
                // should this be: ??
                // $route.reload();
                window.location.reload();
            });
        };

        $scope.prepareable = function(doc) {
            return ($scope.prepare && !$scope.invq && doc && !doc.signature_flow && !$scope.template_original) || ($scope.template_original);
        };

        $scope.signable = function(doc) {
            return $scope.invq && doc && doc.signature_flow > 0 && doc.signature_deadline && !doc.when_signed;
        };

        $scope.rejectable = function(doc) {
            // reject reject signature OR countersignature
            return (!$scope.invq && doc && doc.signature_flow > 0 && doc.when_signed && !doc.when_countersigned) || ($scope.invq && doc && doc.signature_flow > 0 && doc.when_countersigned && !doc.when_finalized);
        };

        $scope.finalizable = function(doc) {
            return (!$scope.invq && doc && doc.signature_flow===1 && doc.when_signed && !doc.when_finalized) ||
                   ($scope.invq && doc && doc.signature_flow===2 && doc.when_countersigned && !doc.when_finalized);
        };

        $scope.voidable = function(doc) {
            return (doc && doc.signature_flow > 0 && doc.when_finalized && doc.when_void_requested && !doc.when_void_accepted && $rootScope.navState.role == "investor");
        };

        $scope.$on('refreshDocImage', function (event) {refreshDocImage();});


        $scope.saveSmartdocData = function(clicked) {
            if (!$scope.used_attributes || $rootScope.navState.role=='investor') {return;}
            SWBrijj.proc("account.company_attribute_update",
                    "state", ($scope.used_attributes.companyState || "")
            ).then(function(x) {
                void(x);
            });
            SWBrijj.proc("account.company_attribute_update",
                    "name", ($scope.used_attributes.companyName || "")
            ).then(function(x) {
                void(x);
            });
            if (clicked) {
                $scope.$emit("notification:success", "Saved annotations");
            }
        };
        $scope.saveNoteData = function(clicked) {
            var nd_inv = JSON.stringify(Annotations.getInvestorNotesForUpload($scope.docId));
            var nd_iss = JSON.stringify(Annotations.getIssuerNotesForUpload($scope.docId));
            if ($scope.lib === undefined) {
                // This happens when "saveNoteData" is called by $locationChange event on the target doc -- which is the wrong one
                // possibly no document loaded?
                return;
            }
            if (!$scope.isAnnotable) return;
            if ($scope.html) {
                // template ...
                return;
            }

            /** @name SWBrijj#saveNoteData
             * @function
             * @param {int}
             * @param {boolean}
             * @param {boolean}
             * @param {json}
             */
            SWBrijj.saveNoteData($scope.docId, $scope.invq, !$scope.lib.original, nd_inv, nd_iss).then(function(data) {
                void(data);
                if (clicked) $scope.$emit("notification:success", "Saved annotations");
            });
        };

        $scope.booleanUpdate = function(attribute, value) {
            if (value === null) {
                value = false;
            }
            $scope.investor_attributes[attribute] = value == "true" ? "false": "true";
        };

        $scope.sigModalUp = function () {
            $scope.signatureModal = true;
        };

        $scope.sigclose = function () {
            $scope.signatureModal = false;
            $scope.scribblemode = false;
        };

        $scope.removeannot = function(annotation) {
            var idx = $scope.annots.indexOf(annotation);
            $scope.annots.splice(idx, 1);
        };

        $scope.$on("$destroy", function( event ) {
            $window.onkeydown = null;
        });

        $scope.drawTime = function() {
            // TODO: check issuerCanAnnotate or investorCanAnnotate depending on role
            return $scope.isAnnotable && $scope.lib && ((!$scope.lib.when_shared && $rootScope.navState.role == "issuer") || (!$scope.lib.when_signed && $rootScope.navState.role == "investor"));
        };

        $scope.user = User;
    }
]);
