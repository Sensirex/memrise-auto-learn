// ==UserScript==
// @name         Memrise Auto Learn Completely
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Fast-track the growth level of words you are planting
// @author       cooljingle (by sensirex)
// @match        https://www.memrise.com/course/*/garden/learn*
// @grant        none
// ==/UserScript==

$(document).ready(function() {
	var g = MEMRISE.garden,
        forceEnd = false,
		response_timeout=500;
	var grown_items=[];
	var autoLearnedId;

	function getValue(formData, name) {
	    var regex = new RegExp(name + "=([^&]+)");
	    var match = (formData || "").match(regex);
	    return match && match[1];
	}
	// console.log(MEMRISE);
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
	
	MEMRISE.garden._events.start.push(() => {
        MEMRISE.garden.shouldFullyGrow = function(thinguser, learnable) {
            console.log('MEMRISE.garden.shouldFullyGrow');
			return true;
        };
		// console.log('MEMRISE.garden.boxes.load');
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
	});
	
	MEMRISE.garden._events.activate.push(() => {
		var box=MEMRISE.garden.box;
		console.log('activate');
		var give_answer=function(){
            clearAutoLearnedFutures();
            // var canAutoLearn = MEMRISE.garden.boxes.current().learn_session_level < 6;
            // console.log('can auto learn: '+(canAutoLearn?'yes':'no'));
            // if(canAutoLearn) {
			// if((['typing','tapping','multiple_choice']).indexOf(MEMRISE.garden.box.template)) {
			// 	MEMRISE.garden.boxes.current().autoLearn=true;
            // }
			// else
			// 	MEMRISE.garden.boxes.current().autoLearn=false;
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
						for(var i in elements){
							if(typeof(elements[i])=='object'&&elements[i].dataset!=undefined&&elements[i].dataset.word==correct_item[j]&&!elements[i].classList.contains('active')){
								elements[i].click();
								break;
							}
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
			location.reload();
		// 	// console.log('set session continue');
            // fetchMore(() => {/*result=cached_function.apply(self, arguments);*/give_answer();});
        } else {
            // result=cached_function.apply(self, arguments);
			give_answer();
        }
	});
	
	
	$(document).ajaxSuccess(
	    function(event, request, settings,dt) {

			if(settings.url=='/api/garden/register/'){
				var t=/learnable_id=(\d+)/;
				var t=settings.data.match(t);
				if(t[1]!=undefined&&grown_items.indexOf(t[1])==-1){
					var li=t[1];
					var thinguser = request.responseJSON && request.responseJSON.thinguser;
					for(var index in MEMRISE.garden.boxes._list)if(MEMRISE.garden.boxes._list[index].learnable_id==li)break;
					var box=thinguser && MEMRISE.garden.boxes._list[index];
					if((['typing','tapping','multiple_choice']).indexOf(MEMRISE.garden.boxes._list[index].template)&&thinguser){
						grown_items.push(li);
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
			}
	    }
	);


});
