//Namespace
var Code4SA = {};

Code4SA.Map = (function(window,document,undefined) {

	var settings = {
		bindToElementId: "Code4SA",
		showMap: true,
		showSeats: true,
		mapAPIUrl: "http://maps.code4sa.org",
		electionsAPIUrl: "http://election-api.code4sa.org",
		year: "2009",
		width: 500,
		height: 450,
		colors: { "AFRICAN NATIONAL CONGRESS": "#008000", "DEMOCRATIC ALLIANCE": "#04599c", "INKATHA FREEDOM PARTY": "#911c1b", "INDEPENDENT DEMOCRATS": "#f87906", "CONGRESS OF THE PEOPLE": "#ffca08", "UNITED DEMOCRATIC MOVEMENT": "#770433", "VRYHEIDSFRONT PLUS": "#ff00a4", "AFRICAN CHRISTIAN DEMOCRATIC PARTY": "#adfc00", "UNITED CHRISTIAN DEMOCRATIC PARTY": "#AE00FF", "PAN AFRICANIST CONGRESS OF AZANIA": "#895E46", "MINORITY FRONT": "", "AZANIAN PEOPLE'S ORGANISATION": "#728915", "AFRICAN PEOPLE'S CONVENTION": "#895E46", "MOVEMENT DEMOCRATIC PARTY": "#4A5C72", "AL JAMA-AH": "#666", "ECONOMIC FREEDOM FIGHTERS": "#ed1b24" },
		seatsTitle: "Parliamentary seats ",
		mapTitle: "Results ",
		ballot: "national", // "national" or "provincial"
	};

	var apiurl = "";
	var mapurl = "";
	var nationalurl = "";

	var curCode = "";
	var curBallot = "";

	var curparent = "";

	var curElem;
	var history = [];

	var num_format = d3.format(",");
	var perc_format = d3.format(".2%");
	var perc_format_short = d3.format(".0%");
	var path = false;

	var svg = false;
	
	var level = 0;
	var levels = ["province", "municipality", "ward"];
	var levels_quantization = [5000, 3000, 3000];

	var wardscache = {};

	var linear_scale = d3.scale.linear().domain([0.2, 1]);

	// var projection = d3.geo.conicEqualArea()
	// 	.center([0, -28.5])
	// 	.rotate([-24.5, 0])
	// 	.parallels([-25.5, -31.5])
	// 	.scale(1800)
	// 	.translate([settings.width/2, settings.height/2]);
	var projection = d3.geo.mercator()
		.scale(1800)
		.center([23, -28.5])
		.translate([settings.width / 2, settings.height / 2]);

	function render() {
		// Renders the DOM
		var el = d3.select("#"+settings.bindToElementId).append("div").attr("class", "container");
		
		if (settings.showSeats) {
			// Parliamentary Seats
			var seats_el = el.insert("div").classed("row", true).classed("clearfix", true).attr("id", "c4sa_seats");
			seats_el.insert("div").classed("col-md-12", true).insert("h3").html(settings.seatsTitle);
			seats_el.insert("div").attr("id", "c4sa_seats_container").classed("col-md-12", true).classed("clearfix", true);
			// seats_el;

			// Seats overlay
			var seats_overlay = d3.select("#"+settings.bindToElementId).insert("div").attr("id", "c4sa_seats_overlay").classed("overlay", true);
			seats_overlay.insert("h5").attr("id", "c4sa_party");
			var seats_el_fields = [
				{ name: "Votes", id: "c4sa_seats_votes" },
				{ name: "Seats", id: "c4sa_seats_seats" },
				{ name: "Percentage", id: "c4sa_seats_percentage" },
			];
			var seats_overlay_table = seats_overlay.insert("table").classed("table", true);
			seats_overlay_table.insert("thead").insert("tr").selectAll("th").data(seats_el_fields).enter()
				.insert("th").text(function(d) { return d.name });
			seats_overlay_table.insert("tbody").insert("tr").selectAll("td").data(seats_el_fields).enter()
				.insert("td").attr("id", function(d) { return d.id });
		}
		
		

		// Map
		if (settings.showMap) {
			var map_el = el.insert("div").classed("row", true).attr("id", "c4sa_map_container");

			map_el
				.insert("div")
				.classed("col-md-12", true)
				.insert("h3")
				.html(settings.mapTitle);


			svg_container = map_el.insert("div").classed("col-md-12", true);
			//Zoom Out
			var zout = svg_container.insert("div").attr("id", "c4sa_resetdiv").insert("a").attr("id", "c4sa_zoomout").style("display", "none").attr("class", "btn btn-primary pull-right").text("Zoom out").on("click", zoomout);

			// Results Area
			var results_area = svg_container.insert("div").attr("id", "results_area");
			var year_area = results_area.insert("div").classed("row", true)
				.insert("div").classed("col-md-6", true)
				.insert("div").classed("btn-group", true)
				;
			year_area.insert("button").attr("type", "button")
				.text("2009")
				.classed("btn", true)
				.classed("btn-default", function() { return (settings.year != "2009") })
				.classed("btn-primary", function() { return (settings.year == "2009") })
				.classed("c4sa_btn_year", true)
				.attr("id", "c4sa_btn_year_2009")
				.on("click", function() { change_year("2009") })
				;
			year_area.insert("button").attr("type", "button")
				.text("2014")
				.classed("btn", true)
				.classed("btn-default", function() { return (settings.year != "2014") })
				.classed("btn-primary", function() { return (settings.year == "2014") })
				.classed("c4sa_btn_year", true)
				.attr("id", "c4sa_btn_year_2014")
				.on("click", function() { change_year("2014") })
				;
			var btn_group = results_area.insert("div")
				.classed("btn-group", true).classed("pull-right", true);

			btn_group
				.insert("div")
				.attr("type", "button")
				.classed("btn", true)
				.classed("btn-default", function() { return (settings.ballot == "provincial") })
				.classed("btn-primary", function() { return (settings.ballot == "national") })
				.classed("c4sa_btn_ballot", true)
				.attr("id", "c4sa_btn_ballot_national")
				.on("click", function() { change_ballot("national") })
				.text("National");
			btn_group
				.insert("div")
				.attr("type", "button")
				.classed("btn", true)
				.classed("btn-default", function() { return (settings.ballot == "national") } )
				.classed("btn-primary", function() { return (settings.ballot == "provincial") } )
				.classed("c4sa_btn_ballot", true)
				.attr("id", "c4sa_btn_ballot_provincial")
				.on("click", function() { change_ballot("provincial") })
				.text("Provincial");

			results_area.insert("table")
				.classed("table", true).classed("table-striped", true);
					
			svg = svg_container.insert("svg").attr("id", "c4sa_map_svg");
			svg.append('defs').append('pattern');
			

			svg.attr("viewBox", "0 0 " + settings.width + " " + (settings.height + 100)).attr("id", "c4sa_svg");
			

			mapg = svg.append("g").attr("id", "c4sa_map").classed("level-0", true);

			mapg.append("g").attr("id", "c4sa_province").classed("level-0", true).append("g");
			mapg.append("g").attr("id", "c4sa_municipality").classed("level-1", true).append("g");
			mapg.append("g").attr("id", "c4sa_ward").classed("level-2", true).append("g");
			mapg
				.on("mousemove", move_overlay)
				.on("mouseout", hide_overlay);

			// Loading overlay
			el.insert("div").attr("id","c4sa_loading_container").insert("div").attr("id", "progtext").html("Loading");

			// Map results overlay
			var overlay_el = el.insert("div").attr("id", "c4sa_overlay").classed("overlay", true);
			overlay_el.insert("h3").attr("id", "c4sa_demarcation_title");
			var overlay_el_fields = [
				{name: "Registered", id: "c4sa_num_registered", field: "num_registered" },
				{name: "Spoilt", id: "c4sa_spoilt_votes", field: "spoilt_votes" },
				{name: "Total", id: "c4sa_total_votes", field: "total_votes" }
			];
			var overlay_table = overlay_el
				.append("table").classed("table", true);
			overlay_table
				.append("tr")
				.selectAll("th")
				.data(overlay_el_fields)
				.enter()
					.append("th")
					.html(function(d) { return d.name });
			overlay_table
				.append("tr")
				.selectAll("td")
				.data(overlay_el_fields)
				.enter()
					.append("td")
					.classed("metadata", true)
					.attr("id", function(d) { return d.id })
					.attr("data-src", function(d) { return d.field });
			overlay_el
				.append("table").classed("table", true).classed("table-striped", true).append("tbody").attr("id", "c4sa_vote_results");
		}

		var logo = el.append("a").attr("href", "http://code4sa.org").attr("id", "c4sa_logo");
		if (settings.showMap) {
			logo.append("img").attr("src", "http://hood.code4sa.org/static/logo-184x100.png").attr("alt", "Code for South Africa");
		} else {
			logo.text("Code for South Africa");
		}
	} //Render

	function load_level(curlevel, filter) {
		show_loader();
		var data_url = apiurl + settings.year + "/" + levels[curlevel] + "/?all_results=true";
		var map_url = mapurl + settings.year + "/" + levels[curlevel] + "?quantization=" + levels_quantization[curlevel];
		if (filter) {
			for (key in filter) {
				data_url = data_url + "&"+key+"="+filter[key];
				map_url = map_url + "&filter["+key+"]="+filter[key];
			}
		}
		var data_job = d3.json(data_url)
		var map_job = d3.json(map_url)
		queue()
			.defer(map_job.get)
			.defer(data_job.get)
			.await(function (error, map, data) {
				update_map(map, data.results, levels[curlevel]);
				hide_loader();
			});
	}

	function change_ballot(ballot) {
		// console.log(curElem);
		settings.ballot = ballot;
		apiurl = settings.electionsAPIUrl + "/" + ballot + "/";
		update_data();
		update_results_table();
		d3.selectAll(".c4sa_btn_ballot").classed("btn-primary", false).classed("btn-default", true);
		d3.select("#c4sa_btn_ballot_" + ballot).classed("btn-primary", true).classed("btn-default", false);
	}

	function change_year(year) {
		settings.year = year;
		init();
		d3.selectAll(".c4sa_btn_year").classed("btn-primary", false).classed("btn-default", true);
		d3.select("#c4sa_btn_year_" + year).classed("btn-primary", true).classed("btn-default", false);
	}

	function update_data() {
		for(var curlevel = level; curlevel >=0; curlevel--) {
			var filter = {};
			if (curlevel == 1) {
				if (level == 1) {
					filter = { province: curElem.id }
				} else {
					filter = { province: curElem.properties.province }
				}
			} else if (curlevel == 2) {
				filter = { municipality: curElem.id }
			}
			load_level(curlevel, filter);
		}
	}

	function update_map(mapdata, data, demarcation) {

		//Add some data
		if (mapdata) {
			//Let's prep the area
			var demarcg = mapg.select("g#c4sa_" + demarcation);
			demarcg.selectAll("g").remove();
			var area = demarcg.insert("g").attr("class", "c4sa_area");
			var border = demarcg.insert("g").attr("class", "c4sa_border");
			var textual = demarcg.insert("g").attr("class", "c4sa_textual");
			var topo = topojson.feature(mapdata, mapdata.objects.demarcation).features;
			for(var x = 0; x < topo.length; x++) {
				for(var y = 0; y < data.length; y++) {
					if (data[y][demarcation + "_id"] == topo[x].id) {
						topo[x].properties.results = data[y].results;
						topo[x].properties.winner = calc_winners(data[y].results.vote_count);
						topo[x].properties.winner.perc = topo[x].properties.winner.vote_count / data[y].results.meta.total_votes;
						if (isNaN(topo[x].properties.winner.perc)) {
							topo[x].properties.winner.perc = 0;
						}
					}
				}
				topo[x].properties.level = levels.indexOf(demarcation);
			}

			//Plot our areas
			var areas = area.selectAll("." + demarcation).data(topo);
			areas
				.enter().append("path")
				.attr("class", function(d) { 
					if ((d.properties.winner) && (d.properties.winner.party)) {
						var winner_id = safe_id(d.properties.winner.party);
					} else {
						var winner_id = "none";
					}
					return demarcation + " " + d.id + " " + "winner_" + winner_id; 
				})
				.style("fill", function(d, i) {
					if (d.properties.winner && !isNaN(d.properties.winner.perc) && (d.properties.winner.perc > 0)) {
						
						// return gen_pattern(d3.rgb(colors[d.properties.winner.party]).darker(linear_scale(d.properties.winner.perc)), "party_" + 1); 
						// return d3.rgb(colors[d.properties.winner.party]).brighter(linear_scale(d.properties.winner.perc)); 
						return d3.rgb(colors[d.properties.winner.party]).darker(linear_scale(d.properties.winner.perc))
					} else {
						// return gen_pattern("#444", "empty_" + i);
						return("#CCC")
					}
				})
				.attr("id", function(d) { return "c4sa_" + d.id })
				.attr("d", path)
				.on("click", zoomin)
				.on("mousemove", hovered)
				.on("mouseout", unhovered);

			//Chuck on a border
			var stroke = border.append("path")
				.datum(topojson.mesh(mapdata, mapdata.objects.demarcation, function (a, b){ return a !== b; }))
				.attr("class", "border " + demarcation + "-border")
				.attr("d", path)
				.style("stroke-width", "0.1px");

			//Let's put some text on there
			if (demarcation == "province") {
				var txt = textual.selectAll(".province-label")
					.data(topo)
					.enter()
					.append("text")
					.attr("class", "province-label")
					.attr("transform", function(d) {
						return "translate(" + path.centroid(d) + ")";
					})
					.attr("text-anchor", "middle")
					.attr("dy", ".35em")
					.text(function(d) { 
						// console.log(d);
						if (d.properties.province_name) {
							// console.log(d.properties);
							return d.properties.province_name; 
						} else {
							return "";
						}
					});
			} else if (demarcation == "municipality") {
				var txt = textual.selectAll(".place-label")
					.data(topo)
					.enter()
					.append("text")
					.attr("class", "place-label")
					.attr("transform", function(d) {
						return "translate(" + path.centroid(d) + ")";
					})
					.attr("text-anchor", "middle")
					.attr("dy", ".35em")
					
					.text(function(d) { 
						if (d.properties.municipality_name) {
							// console.log(d.properties.municipality_name);
							return d.properties.municipality_name; 
						} else {
							return "NA";
						}
					})
					.style("font-size", function(d) {
						var b = path.bounds(d);
						var w = b[1][0] - b[0][0];
						if (w < 10) {
							return "2px";
						}
						// console.log(w, Math.min((w - 8) / this.getComputedTextLength() * 10), d.properties.municipality_name) ;
						return Math.min(4, (w - 8) / this.getComputedTextLength() * 12)  + "px"; 
					})
					.attr("id", function(d) {
						return "c4sa_text_"+d.properties.municipality;
					})
					;
			}
			// console.log(sender);
			// hide_parents(sender);
		}
		return true;
	} //update_map


	var events_queued = [];

	function show_loader() {
		d3.select("#c4sa_loading_container")
			.style("display", "block")
			.style("opacity", 1);
		events_queued = [];
		d3.select("#progtext").html("Loading...");	
	}

	function hide_loader() {
		d3.select("#c4sa_loading_container")
			.style("opacity", 1)
			.style("opacity", "block")
			.transition()
			.duration(400)
			.style("opacity", 0)
			.each("end", function() {
				d3.select("#c4sa_loading_container").style("display", "none");
			});
	}

	// var prev_angle = 0;
	function updateprog(event_name, curr, total) {
		// var progarc = d3.svg.arc().outerRadius(95).innerRadius(50).startAngle(0);
		var tot = 0;
		var tot_loaded = 0;
		if (events_queued.indexOf(event_name) == -1) {
			if (curr == total) {
				events_queued.push(event_name);
			}
		}
		// d3.select("#progbar")
		// 	.attr("d", progarc.endAngle(0))
		// 	.transition()
		// 	.duration(400)
		// 	.attr("d", progarc.endAngle(events_queued.length * Math.PI));
		d3.select("#progtext").html("Loading...");
	}

	function init() {
		if (settings.showSeats) {
			init_seats();
		}
		d3.selectAll(".data-year").html(settings.year);
		if (settings.showMap) {
			load_level(0);
			update_results_table();
		}
	}

	d3.select("#year_2009").on("click", function() {
		settings.year = "2009";
		init();
	});

	d3.select("#year_2014").on("click", function() {
		settings.year = "2014";
		init();
	});

	function progressive_load(d) {
		hide_overlay();
		var areag = mapg.select("g#c4sa_areas");
		show_loader();
		if (level == 1) {
			load_level(level, { province: d.id });
		}
		if (level == 2) {
			//Load Wards
			load_level(level, { municipality: d.id });
		}
		hide_loader();
	}

	function hide_parents(d) {
		var areag = mapg.select("g#c4sa_areas");
		switch(level) {
			case 0:
				return;
			case 1: //Municipal level - hide province
				d3.selectAll(".province")
					.style("display", "inherit");
				d3.selectAll(".municipality")
					.style("display", "inherit");
				d3.select("#c4sa_" + d.properties.province).style("display", "none");
				d3.select("#c4sa_" + d.properties.municipality).style("display", "none");
				return;
			case 2: //Ward level - hide province and municipality
				d3.select("#c4sa_" + d.properties.municipality).style("display", "none");
				d3.select("#c4sa_" + d.properties.province).style("display", "none");
				return;
		}

	}

	function zoomin(d) {
		curElem = d;
		level = d.properties.level + 1;
		if (level < 3) {
			progressive_load(d);
		}
		d3.selectAll(".place-label")
			.style("display", "inherit");
		if (level > 0) {
			d3.select("#c4sa_zoomout").style("display", "inline");
		}
		if (level == 1) {
			d3.selectAll(".province")
				.style("display", "inherit");
		}
		if (level == 2) {
			d3.selectAll(".municipality")
				.style("display", "inherit");
			d3.select("#c4sa_text_"+d.properties.municipality)
				.style("display", "none");
		}
		var x, y, dx, dy, k, w, h;
		var centroid = path.centroid(d);
		x = centroid[0];
		y = centroid[1];
		var bounds = path.bounds(d);
		dx = bounds[1][0] - bounds[0][0];
		dy = bounds[1][1] - bounds[0][1];
		k = .8 / Math.max(dx / settings.width, dy / settings.height);
		mapg.transition()
			.duration(750)
			.attr("transform", "translate(" + settings.width / 2 + "," + settings.height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
			.each("end", function() {
				// hide_parents(d);
			});

		mapg.attr("class", "level-" + level);
		// console.log(k);
		// svg.selectAll(".c4sa_textual")
		// 	.style("font-size", "2px")
		// 	.attr("blah", function(d) { console.log(d) });
	}

	

	function zoomout() {
		if (level == 1) {
			mapg.transition()
			.duration(750)
			.attr("transform", "translate(0,0)scale(1)");
			level = 0;
			mapg.attr("class", "level-" + level);
			d3.selectAll(".municipality")
				.style("display", "none");
			d3.selectAll(".ward")
				.style("display", "none");
			d3.selectAll(".province")
				.style("display", "inherit");
			d3.select("#c4sa_zoomout")
				.style("display", "none");
		} else if (level == 2) {
			el = d3.select("#c4sa_" + curElem.properties.province);
			zoomin(el.data()[0]);
		} else if (level == 3) {
			el = d3.select("#c4sa_" + curElem.properties.municipality);
			zoomin(el.data()[0]);
		}
	}

	function calc_winners(vote_count) {
		var winners = [];
		var winner = {};
		var top = 0;
		var tot = 0;
		for(var party in vote_count) {
			if (vote_count[party] > top) {
				top = vote_count[party];
				winner = { party: party, vote_count: vote_count[party] };
			}
		}
		return winner;
	}

	function sort_votes(vote_count) {
		var tmp = [];
		for (party in vote_count) {
			tmp.push([party, vote_count[party]]);
		}
		tmp.sort(function(a, b) { return b[1] - a[1] });
		return tmp.slice(0, 3);
	}

	var hovering = false;

	function move_overlay() {
		var coordinates = [0, 0];
		coordinates = d3.mouse(svg.node());
		var x = d3.event.pageX - 200;
		var y = d3.event.pageY + 20;
		var overlay = d3.select("div#c4sa_overlay");
		overlay
			.style("display", "block")
			.style("top", y + "px")
			.style("left", x + "px");
	}

	function hide_overlay() {
		var overlay = d3.select("div#c4sa_overlay");
		overlay
			.style("display", "none");
	}

	function hovered(d) {
		if (!hovering) {
			hovering = true;
			
			var title = "";
			if (d.properties.level == 0) {
				title = d.properties.province_name;
			} else if (d.properties.level == 1) {
				title = d.properties.municipality_name + ", " + d.properties.province;
			} else {
				title = "Ward " + d.properties.ward_number + ", " + d.properties.municipality_name;
			}
			if (d.properties.results) {
				var results = d.properties.results;
			} else {
				results = {
					meta: {
						spoilt_votes: 0,
						num_registered: 0, 
						section_24a_votes: 0, 
						total_votes: 0
					},
					vote_count: 0
				};
			}
			if (d.properties.winner) {
				var winner = d.properties.winner;
			} else {
				winner = {party: "none", votes: 0};
			}

			d3.selectAll(".province").style("opacity", "0.8");
			d3.selectAll(".municipality").style("opacity", "0.8");
			d3.selectAll(".ward").style("opacity", "0.8");
			d3.select("#c4sa_" + d.id).style("opacity", "1");
			d3.selectAll(".party").classed("active", false);
			if (winner.party) {
				d3.select("#" + safe_id(winner.party)).classed("active", true);
				d3.select("#c4sa_hoverblurb").text(winner.party + " " + Math.round(winner.perc * 100) + "%");
			}
			d3.select("#c4sa_hovername").text(d.id);
			d3.select("#c4sa_demarcation_title").text(title);
			
			d3.select("#c4sa_section_24a_votes").text( num_format(results.meta.section_24a_votes) );
			d3.select("#c4sa_num_registered").text( num_format(results.meta.num_registered) );
			
			d3.select("#c4sa_special_votes").text( num_format(results.meta.special_votes) );
			d3.select("#c4sa_spoilt_votes").text( num_format(results.meta.spoilt_votes) );
			d3.select("#c4sa_total_votes").text( num_format(results.meta.total_votes) );
			var total_votes = results.meta.total_votes;
			d3.select("#c4sa_vote_results").html("");
			var tabsel = d3.select("#c4sa_vote_results")
				.selectAll("tr")
				.data(sort_votes(results.vote_count));
			var newtr = tabsel.enter()
				.append("tr")
				.attr("class", function(d) {
					return "party row-" + d[0].replace(/\s/g, "_").toLowerCase(); 
				});
			newtr.append("td").text(function (d) { return d[0]; });
			newtr.append("td").text(function(d) { return num_format(d[1]) });
			newtr.append("td").text(function(d) { return perc_format(d[1] / total_votes) })
		}
	};

	function unhovered(d) {
		d3.select("#c4sa_hovername").text("");
		d3.select("#c4sa_hoverobj").remove();
		hovering = false;
	};


	function safe_id(s) {
		return s.replace(/[^A-Za-z0-9]/g,"");
	}

	function init_seats() {
		var seats=d3.select("#c4sa_seats_container");
		d3.json(nationalurl + settings.year + "/", function(error, data) {
			// console.log(data);
			var tmp = [];
			var tot = 0;
			for (party in data.results.vote_count) {
				tmp.push({ party: party, votes: data.results.vote_count[party] });
				tot += data.results.vote_count[party];
			}
			// console.log(tot / 200);
			tmp.sort(function(a, b) { if (a.votes < b.votes) return 1; return -1; });

			var seat_count = 0;
			d3.select("#c4sa_seats_container").selectAll("div").remove();
			var seatdivs = d3.select("#c4sa_seats_container").selectAll("div").data(tmp).enter().append("div").attr("class", "party").attr("id", function(d) { 
					return safe_id(d.party)
				})
				.each(
					function(d) {
						// console.log(d);
						// console.log(d.party, (d.votes / tot * 200));
						for(var x = 0; x < Math.round(d.votes / tot * 200); x++) {
							seat_count++;
							if (seat_count < 200) {
								d3.select("#" + safe_id(d.party)).append("div").attr("class", "seat").style("background-color", function(d) {
									return colors[d.party];
								});
							}
						}
					}
				).on("mousemove",
					function(d) {
						d3.selectAll("div.party").classed("active", false);
						d3.select("#" + safe_id(d.party)).classed("active", true);
						var el = d3.select("#c4sa_seats_overlay");
						el.select("#c4sa_party").text(d.party);
						el.select("#c4sa_seats_votes").text(num_format(d.votes));
						el.select("#c4sa_seats_seats").text(Math.round(d.votes / tot * 200));
						el.select("#c4sa_seats_percentage").text(perc_format(d.votes / tot));
						d3.selectAll(".province").style("opacity", "0.8");
						d3.selectAll(".municipality").style("opacity", "0.8");
						d3.selectAll(".ward").style("opacity", "0.8");
						d3.selectAll(".winner_" + safe_id(d.party)).style("opacity", "1");
					}
				);
			

		});
		d3.select("#c4sa_seats_container").on("mouseout", function(d) {
			d3.select("#c4sa_seats_overlay").style("display", "none");
		})
		.on("mousemove", function(d) {
			var el = d3.select("#c4sa_seats_overlay");
			if (el.select("#c4sa_party").text()) {
				el.style("display", "block");
				if (d3.event.layerY < (d3.select("#c4sa_seats")[0][0].clientHeight )) {
					el.style("margin-top", (d3.event.clientY + window.scrollY + 10) + "px");
				} else {
					el.style("margin-top", (d3.event.clientY + window.scrollY - 100) + "px");
				}
				if (d3.event.layerX < 150) {
					el.style("margin-left", "20px");
				} else if (d3.event.clientX > (d3.select("#c4sa_seats_container")[0][0].offsetWidth - 80)) {
					el.style("left", (d3.select("#c4sa_seats_container")[0][0].offsetWidth - 250) + "px");
				} else {
					el.style("left", (d3.event.clientX - 150) + "px");
				}
			}
		});
	}

	function update_results_table() {
		// console.log("Updating results table");
		// console.log(settings.electionsAPIUrl + "/" + settings.ballot + "/" + settings.year + "/");
		d3.json(settings.electionsAPIUrl + "/" + settings.ballot + "/" + settings.year + "/", function(error, data) {
			var tmp = [];
			var tot = 0;
			for (party in data.results.vote_count) {
				tmp.push({ party: party, votes: data.results.vote_count[party] });
				tot += data.results.vote_count[party];
			}
			tmp.sort(function(a, b) { if (a.votes < b.votes) return 1; return -1; });
			d3.select("#results_area")
				.select("table")
				.remove();
			d3.select("#results_area")
				.append("table").classed("table table-striped", true)
				.append("tbody")
				.selectAll("tr")
				.data(tmp, function(d, i) { return d + i; })
				.enter()
				.append("tr")
				.html(function(d) {
					p = 0;
					if (d.votes > 0) {
						var p = d.votes / data.results.meta.total_votes;
					}
					return "<td><img class='party-logo' src='resources/logos/small-"+ d.party.replace(/[^\w]/gi, "") + ".jpg' /></td><td>"+d.party+"</td><td>"+num_format(d.votes) + "</td><td>" + perc_format(p) + "</td>"; 
				});
			}
		);
	}

	function merge(obj1, obj2) {
		for (key in obj2) {
			if(typeof obj1[key] == "object") {
				merge(obj1[key], obj2[key]);
			}
			obj1[key] = obj2[key];
		}
	}

	return {
	//Public Methods
		deploy: function(newsettings) {
			merge(settings, newsettings);
			apiurl = settings.electionsAPIUrl + "/" + settings.ballot + "/";
			mapurl = settings.mapAPIUrl + "/political/";
			nationalurl = settings.electionsAPIUrl + "/national/";
			// year = settings.year;
			

			path = d3.geo.path().projection(projection);
			// width = settings.width;
			// height = settings.height;
			colors = settings.colors;
			render();
			init();
		}
	};

})(this, this.document);
