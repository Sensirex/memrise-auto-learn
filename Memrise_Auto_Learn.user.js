// ==UserScript==
// @name         Memrise Auto Learn Completely
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Fast-track the growth level of words you are planting
// @author       cooljingle (by sensirex)
// @match        https://www.memrise.com/course/*/garden/learn/
// @grant        none
// ==/UserScript==

$(document).ready(function() {
	var g = MEMRISE.garden,
        forceEnd = false,
		response_timeout=600;
		
	function fetchMore(callback) {
        $.getJSON("https://www.memrise.com/ajax/session/", g.session_params)
        .done(function( response ) {
            var removed = _.remove(response.boxes, b => {
                if(_.any(g.boxes._list, x => x.autoLearn && x.learnable_id === b.learnable_id)) {
                    b.autoLearned = true;
                    return true;
                } else {
                    var thinguser = _.find(response.thingusers, t => t.learnable_id === b.learnable_id);
                    return thinguser && new Date(thinguser.next_date) > new Date();
                }
            });
            if(response.session && response.session.slug !== "practise") {
                if(_.filter(removed, r => r.autoLearned).length){
                    setTimeout(() => fetchMore(callback), 500);
                    return;
                } else {
                    //boxes
                    _.each(response.boxes, function(b){$.extend(b, {scheduled: true});});
                    Array.prototype.splice.apply(g.boxes._list, [g.boxes._list.length -1 , 0].concat(response.boxes));
                    //learnables
                    _.each(response.learnables, l => g.learnables[l.learnable_id] = l);
                    //screens
                    $.extend(MEMRISE.garden.screens, response.screens);
                    if(g.populateScreens)
                        g.populateScreens();
                    if(g.populateScreenAudios)
                        g.populateScreenAudios();
                    //things_to_courses
                    $.extend(g.things_to_courses, response.things_to_courses);
                    //thingusers
                    g.thingusers.load(response.thingusers);

                    $('#infinite-learning').text(Object.keys(g.learnables).length);
                }
            }
            callback();
        })
        .fail(function( jqxhr, textStatus, error ) {
            var err = textStatus + ", " + error;
            console.log( "Request Failed: " + err );
            callback();
    	});
    }
		
	function getValue(formData, name) {
	    var regex = new RegExp(name + "=([^&]+)");
	    var match = (formData || "").match(regex);
	    return match && match[1];
	}

	MEMRISE.garden.boxes.load = (function() {
	    var cached_function = MEMRISE.garden.boxes.load;
	    return function() {
	        var autoLearnedId;
			// console.log('MEMRISE.garden.boxes.load');
	        function clearAutoLearnedFutures(){
	            if(autoLearnedId) {
	                MEMRISE.garden.boxes.num--;
	                MEMRISE.garden.boxes.remove_all_future_matching({
	                    learnable_id: autoLearnedId
	                });
	                MEMRISE.garden.boxes.num++;
	                autoLearnedId = undefined;
	            }
	        }

	        MEMRISE.garden.register = (function() {
	            var cached_function = MEMRISE.garden.register;
	            return function() {
					// console.log('MEMRISE.garden.register',arguments);
	                var context = arguments[0];
	                if(context.autoLearn){
	                    if(arguments[1] === 1) {
	                        autoLearnedId = context.learnable_id;
	                    } else {
	                        context.autoLearn = false;
	                    }
	                }
	                return cached_function.apply(this, arguments);
	            };
	        }());

	        MEMRISE.garden.boxes.activate_box = (function() {
	            var cached_function = MEMRISE.garden.boxes.activate_box;
	            return function() {
					var result;
					var self = this,
	                    prevBox = this._list[this.num - 1],
	                    box = (prevBox && prevBox.autoLearn) ? _.find(this._list.slice(this.num), l => l.learnable_id !== prevBox.learnable_id) : this._list[this.num];
					
					// console.log('MEMRISE.garden.boxes.activate_box');
					var give_answer=function(){
		                clearAutoLearnedFutures();
		                var canAutoLearn = MEMRISE.garden.boxes.current().learn_session_level < 6;
		                console.log('can auto learn: '+(canAutoLearn?'yes':'no'));
		                if(canAutoLearn) {
							MEMRISE.garden.boxes.current().autoLearn=true;
		                }
						// console.log(MEMRISE.garden.box.template);
		                if(MEMRISE.garden.box.template=='presentation'){
							setTimeout(function(){
								MEMRISE.garden.box.$next.click();
							},response_timeout);
							// console.log('clicked');
						}
						
						if(MEMRISE.garden.box.template=='tapping'){
							setTimeout(function(){
								var elements=MEMRISE.garden.box.$elem.find('.word-box.word-box-choice .word.btn');
								var hasWords=[];
								var correct_idx=-1;
								for(var i in elements)
									if(typeof(elements[i])=='object'&&elements[i].dataset!=undefined&&elements[i].dataset.word!=undefined)
										hasWords.push(elements[i].dataset.word);
								for(var i in MEMRISE.garden.box.testData.correct){
									var item_correct=MEMRISE.garden.box.testData.correct[i];
									var tmp=item_correct.filter((n)=>{
									    return hasWords.indexOf(n) !== -1;
									});
									if(tmp.length==item_correct.length){
										correct_idx=i;
										break;
									}
								}
								var correct_item=MEMRISE.garden.box.testData.correct[correct_idx];
								for(var j in correct_item){
									for(var i in elements)
										if(typeof(elements[i])=='object'&&elements[i].dataset!=undefined&&elements[i].dataset.word==correct_item[j]){
											elements[i].click();
											break;
										}
								}
							},response_timeout);
						}
						
						if(MEMRISE.garden.box.template=='audio-multiple-choice'){
							setTimeout(function(){
								var elements=MEMRISE.garden.box.$elem.find('.audio-choices .audio-choice.js-audio-choice');
								for(var i in elements){
									if(typeof(elements[i])=='object'&&elements[i].dataset!=undefined&&MEMRISE.garden.box.testData.correct.indexOf(elements[i].dataset.choice)!=-1){
										elements[i].click();
										MEMRISE.garden.box.$next.click();
										break;
									}
								}
							},response_timeout);
						}
		                if(MEMRISE.garden.box.template=='multiple_choice'||MEMRISE.garden.box.template=='video-pre-presentation'||MEMRISE.garden.box.template=='reversed_multiple_choice'){
							setTimeout(function(){
			                    var ch=-1;
			                    for(var i in MEMRISE.garden.box.choices)if(MEMRISE.garden.box.choices[i].correct){ch=MEMRISE.garden.box.choices[i].id;break;}
			                    MEMRISE.garden.box.$choices.find('[data-choice-id="'+ch+'"]').click();
							},response_timeout);
		                }
						
		                if(MEMRISE.garden.box.template=='typing'||MEMRISE.garden.box.template=='audio-typing'){
							setTimeout(function(){
			                    MEMRISE.garden.box.$input.input.val(MEMRISE.garden.box.testData.correct[0]);
			                    MEMRISE.garden.box.$next.click();
							},response_timeout);
		                }
					};
	                if(box.template === "end_of_session" && !forceEnd) {
						// console.log('set session continue');
	                    fetchMore(() => {result=cached_function.apply(self, arguments);give_answer();});
	                } else {
	                    result=cached_function.apply(self, arguments);
						give_answer();
	                }
					
	                return result;
	            };
	        }());
	        var r=cached_function.apply(this, arguments);
	        return r;
	    };
	}());

	$(document).ajaxSuccess(
	    function(event, request, settings) {
			// console.log('ajaxSuccess');
	        var thinguser = request.responseJSON && request.responseJSON.thinguser,
	            correctAnswer = getValue(settings.data, "score") === "1",
	            canUpdate = getValue(settings.data, "update_scheduling") !== "false",
	            box = thinguser && _.findLast(MEMRISE.garden.boxes._list, function(i) {
	                return i.answered === true &&
	                    i.autoLearn === true &&
	                    i.learnable_id === thinguser.learnable_id;
	            }),
	            isValidRequest = !!(thinguser && correctAnswer && canUpdate && box && thinguser.growth_level < 6);

	        if (isValidRequest) {
				console.log('compleate');
	            var hasGrown = getValue(settings.data, "growth_level") != thinguser.growth_level;
	            settings.data = settings.data.replace(/points=\d+(&growth_level=\d+){0,1}/, "points=0&growth_level=" + thinguser.growth_level);
	            if(hasGrown){
	                var autoLearnCount = thinguser.growth_level - (box.thinguser === null ? 0 : box.thinguser.growth_level) + 1;
	                MEMRISE.garden.stats.show_message("Auto Learn +" + autoLearnCount);
	            }
	            setTimeout(function(){
	                $.post(settings.url, settings.data);
	            }, 300);
	        }
	    }
	);


});
