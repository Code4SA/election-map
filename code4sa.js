var Code4SA = {};
//Namespace

Code4SA.Framework = (function(window,document,undefined) {
	var settings = {
		bindToElementId: "code4sa",
		project: "test",
		apiKey: ""
	};

	var el = null;

	//Private Methods
	var bindEl = function() {
		el = document.getElementById(settings.bindToElementId);
		Code4SA.template.render(el);
	};

	return {
	//Public Methods
		deploy: function(project) {
			bindEl();
			settings.project = project;
			el.className += "code4sa_deploy";
			// console.log(el, settings);
			Code4SA.app.init();
		}
	};

})(this, this.document);

// var apiurl = "http://localhost:5000/national/";
// var mapurl = "http://localhost:8080/political/";

var apiurl = "http://5.9.195.4/national/";
var mapurl = "http://maps.code4sa.org/political/";

var provinceurl = apiurl + "2009/province/";
var municipalurl = apiurl + "2009/municipality/?all_results=true";
var wardurl = apiurl + "2009/ward/?all_results=true";

var width = 500;
var height = 450;

var curCode = "";
var curBallot = "";

var curElem;
var history = [];

var projection = d3.geo.conicEqualArea()
    .center([0, -28.5])
    .rotate([-24.5, 0])
    .parallels([-25.5, -31.5])
    .scale(1800)
    .translate([width/2, height/2]);

 var path = d3.geo.path().projection(projection);

var svg = d3.select("div#c4sa_map_container").select("svg");
svg.attr("viewBox", "0 0 " + width + " " + (height + 100)).attr("id", "c4sa_svg");

var mapg = svg.select("g#c4sa_map")
	.on("mousemove", move_overlay)
	.on("mouseout", hide_overlay);
var selph = mapg.select("g#c4sa_selph");
var hoverph = mapg.select("g#c4sa_hoverph");
var borderg = mapg.select("g#c4sa_borders");

var province_job = d3.json(mapurl + "province?quantization=5000");

var province_data_job = d3.json(provinceurl);
var municipal_data_job = d3.json(municipalurl);
var ward_data_job = d3.json(wardurl);

var level = 0;
var levels = ["province", "municipality", "ward"];
var levels_zoom = [1, 4, 15];
var wardscache = {};

var linear_scale = d3.scale.linear().domain([0.3, 0.8]);

// var colors = { "AFRICAN NATIONAL CONGRESS": 30, "DEMOCRATIC ALLIANCE": 190, "INKATHA FREEDOM PARTY": 270, "INDEPENDENT DEMOCRATS": 60, "CONGRESS OF THE PEOPLE": 90, "UNITED DEMOCRATIC MOVEMENT": 170 };

var colors = { "AFRICAN NATIONAL CONGRESS": "#d73027", "DEMOCRATIC ALLIANCE": "#4575b4", "INKATHA FREEDOM PARTY": "#fee090", "INDEPENDENT DEMOCRATS": "#e0f3f8", "CONGRESS OF THE PEOPLE": "#91bfdb", "UNITED DEMOCRATIC MOVEMENT": "#fc8d59" };

function update_map(mapdata, data, demarcation) {
	// var areag = mapg.select("g#c4sa_areas");
	// var borderg = mapg.select("g#c4sa_borders");

	//Let's prep the area
	var demarcg = mapg.select("g#c4sa_" + demarcation);
	demarcg.selectAll("g").remove();
	var area = demarcg.insert("g").attr("class", "c4sa_area");
	var border = demarcg.insert("g").attr("class", "c4sa_border");

	//Add some data
	var topo = topojson.feature(mapdata, mapdata.objects.demarcation).features;
	for(var x = 0; x < topo.length; x++) {
		for(var y = 0; y < data.length; y++) {
			if (data[y][demarcation + "_id"] == topo[x].id) {
				topo[x].properties.results = data[y].results;
				topo[x].properties.winner = calc_winners(data[y].results.vote_count);
				topo[x].properties.winner.perc = topo[x].properties.winner.vote_count / data[y].results.meta.total_votes;
			}
		}
		topo[x].properties.level = levels.indexOf(demarcation);
	}

	//Plot our areas
	var areas = area.selectAll("." + demarcation).data(topo);
	areas
		.enter().append("path")
		.attr("class", function(d) { return demarcation + " " + d.id })
		.style("fill", function(d) { 
			if (d.properties.winner) {
				return d3.rgb(colors[d.properties.winner.party]).darker(linear_scale(d.properties.winner.perc)); 
			} else {
				return "#444";
			}
		})
		.attr("id", function(d) { return d.id })
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

	return true;
}

queue()
	.defer(province_job.get)
	.defer(province_data_job.get)
	.await(function (error, provinces, province_data) {
		province_data = province_data.results;
		update_map(provinces, province_data, "province");
	});

function progressive_load(d) {
	var areag = mapg.select("g#c4sa_areas");
	
	if (level == 1) {
		//Load Minicipalities
		var municipality_job = d3.json(mapurl + "municipality?quantization=3000&filter[province]=" + d.id);
		var municipality_data_job = d3.json(apiurl + "2009/municipality/?all_results=true&province=" + d.id);
		queue()
			.defer(municipality_job.get)
			.defer(municipality_data_job.get)
			.await(function(error, municipality, municipality_data) {
				// areag.selectAll("." + d.id).style("display", "none");
				municipality_data = municipality_data.results;
				update_map(municipality, municipality_data, "municipality");
				
			}
		);
		
	}
	if (level == 2) {
		//Load Wards
		// areag.selectAll(".demarc-level-2").remove();
		// borderg.selectAll(".border-level-2").remove();
		var ward_job = d3.json(mapurl + "ward?quantization=3000&filter[municipality]=" + d.id);
		var ward_data_job = d3.json(apiurl + "2009/ward/?all_results=true&municipality=" + d.id);
		//Fire the queue job
		queue()
			.defer(ward_job.get)
			.defer(ward_data_job.get)
			.await(function (error, ward, ward_data) {
				areag.selectAll("." + d.id).style("display", "none");
				areag.selectAll("." + d.properties.PROVINCE).style("display", "none");
				ward_data = ward_data.results;
				update_map(ward, ward_data, "ward");
			}
		);
	}
}

// function reset_displayed() {
// 	var areag = mapg.select("g#c4sa_areas");
// 	areag.selectAll(".province").style("display", "inherit");
// 	areag.selectAll(".municipality").style("display", "inherit");
// }

function hide_parents(d) {
	var areag = mapg.select("g#c4sa_areas");
	// console.log(level);
	switch(level) {
		case 1:
			return;
		case 2: //Municipal level - hide province
			// areag.selectAll("." + )
			d3.selectAll(".province")
				.style("display", "inherit");
			d3.selectAll(".municipality")
				.style("display", "inherit");
			// console.log(d.properties);
			d3.select("#" + d.properties.province).style("display", "none");
			d3.select("#" + d.properties.municipality).style("display", "none");
			return;
		case 3: //Ward level - hide province and municipality
			var tmp = d3.select("#" + d.properties.municipality).style("display", "none");
			d3.select("#" + tmp.data()[0].properties.province).style("display", "none");
			return;
	}

}

function zoomin(d) {
	curElem = d;
	level = d.properties.level + 1;
	if (level < 3) {
		progressive_load(d);
	}
	// d3.selectAll(".province")
	// 	.style("display", "inherit");
	
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
	}
	var x, y, dx, dy, k, w, h;
	var centroid = path.centroid(d);
	x = centroid[0];
    y = centroid[1];
    var bounds = path.bounds(d);
    dx = bounds[1][0] - bounds[0][0];
    dy = bounds[1][1] - bounds[0][1];
    k = .8 / Math.max(dx / width, dy / height);
    mapg.transition()
    	.duration(750)
    	.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
    	.each("end", function() {
    		hide_parents(d);
    		// if (level < 3) {
    		// 	d3.selectAll("#" + d.id).style("display", "none");
    		// }
    	});
	mapg.attr("class", "level-" + level);
	// d3.selectAll("#" + d.id).style("display", "none");
}

d3.select("#c4sa_zoomout").on("click", zoomout);

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
		console.log(level);
		d3.selectAll(".province")
			.style("display", "inherit");
		d3.select("#c4sa_zoomout")
			.style("display", "none");
	} else if (level == 2) {
		el = d3.select("#" + curElem.properties.province);
		zoomin(el.data()[0]);
	} else if (level == 3) {
		el = d3.select("#" + curElem.properties.municipality);
		zoomin(el.data()[0]);
	}
}

function getNodePos(el)
{
    var body = d3.select('body').node();
 
    for (var lx = 0, ly = 0;
         el != null && el != body;
         lx += (el.offsetLeft || el.clientLeft), ly += (el.offsetTop || el.clientTop), el = (el.offsetParent || el.parentNode))
        ;
    return {x: lx, y: ly};
}



function calc_winners(vote_count) {
	var winners = [];
	var winner = {};
	var top = 0;
	var tot = 0;
	// console.log(vote_count);
	for(var party in vote_count) {
		// console.log(party, vote_count[party]);
		// tot += vote_count[party];
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
// var mappos = getNodePos(d3.select("#c4sa_svg").node());
// var offset_top = 40;

function move_overlay() {
	var coordinates = [0, 0];
	coordinates = d3.mouse(svg.node());
	// console.log(d3.event.pageX);
	// var x = Math.round(coordinates[0] + mappos.x);
	// var y = Math.round(coordinates[1] + mappos.y + offset_top + 130);
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
	
	// console.log(x, y);
	if (!hovering) {
		hoverph.append("path")
			.attr("d", d3.select(this).attr("d"))
			.attr("id", "c4sa_hoverobj");
		hovering = true;
		// console.log(d);
		var title = "";
		// console.log(d.properties);
		if (d.properties.level == 0) {
			title = d.properties.province_name;
		} else if (d.properties.level == 1) {
			title = d.properties.municipality_name + ", " + d.properties.province;
		} else {
			title = "Ward " + d.properties.ward_number + ", " + d.properties.municipality_name;
		}
		// if (level==0) {
			// var province = d.properties.PROVINCE;
		var results = d.properties.results;
		var winner = d.properties.winner;
		// var sorted = sort_votes(d.properties.results.vote_count);
		// console.log(sorted);
		d3.select("#c4sa_hoverblurb").text(winner.party + " " + Math.round(winner.perc * 100) + "%");
		d3.select("#c4sa_hovername").text(d.id);
		d3.select("#c4sa_demarcation_title").text(title);
		var num_format = d3.format(",");
		var perc_format = d3.format(".2%");
		d3.select("#c4sa_section_24a_votes").text( num_format(d.properties.results.meta.section_24a_votes) );
		d3.select("#c4sa_num_registered").text( num_format(d.properties.results.meta.num_registered) );
		
		d3.select("#c4sa_special_votes").text( num_format(d.properties.results.meta.special_votes) );
		d3.select("#c4sa_spoilt_votes").text( num_format(d.properties.results.meta.spoilt_votes) );
		d3.select("#c4sa_total_votes").text( num_format(d.properties.results.meta.total_votes) );
		var total_votes = d.properties.results.meta.total_votes;
		// d3.select("#c4sa_vote_results").text("<tr><td>Party</td><td>Votes</td><td>Perc</td></tr>");
		d3.select("#c4sa_vote_results").html("");
		var tabsel = d3.select("#c4sa_vote_results")
			.selectAll("tr")

			.data(sort_votes(d.properties.results.vote_count));
		// console.log(tabsel.data());
		var newtr = tabsel.enter()
			.append("tr")
			.attr("class", function(d) { return "party row-" + d[0].replace(/\s/g, "_").toLowerCase(); });
		newtr.append("td").text(function (d) { return d[0]; });
		newtr.append("td").text(function(d) { return num_format(d[1]) });
		newtr.append("td").text(function(d) { return perc_format(d[1] / total_votes) })
		// }
	}
};

function unhovered(d) {
	d3.select("#c4sa_hovername").text("");
	d3.select("#c4sa_hoverobj").remove();
	hovering = false;
};


var seats=d3.select("#c4sa_seats_container");
d3.json(apiurl + "2009/", function(error, data) {
	console.log(data);
	var seatdivs = d3.select("#c4sa_seats_container").data(data.results.vote_count);
	seatdivs.enter().append("div");
});
