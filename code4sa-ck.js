function update_map(e,t,n){var r=mapg.select("g#c4sa_"+n);r.selectAll("g").remove();var i=r.insert("g").attr("class","c4sa_area"),s=r.insert("g").attr("class","c4sa_border"),o=topojson.feature(e,e.objects.demarcation).features;for(var u=0;u<o.length;u++){for(var a=0;a<t.length;a++)if(t[a][n+"_id"]==o[u].id){o[u].properties.results=t[a].results;o[u].properties.winner=calc_winners(t[a].results.vote_count);o[u].properties.winner.perc=o[u].properties.winner.vote_count/t[a].results.meta.total_votes}o[u].properties.level=levels.indexOf(n)}var f=i.selectAll("."+n).data(o);f.enter().append("path").attr("class",function(e){return n+" "+e.id}).style("fill",function(e){return e.properties.winner?d3.rgb(colors[e.properties.winner.party]).darker(linear_scale(e.properties.winner.perc)):"#444"}).attr("id",function(e){return e.id}).attr("d",path).on("click",zoomin).on("mousemove",hovered).on("mouseout",unhovered);var l=s.append("path").datum(topojson.mesh(e,e.objects.demarcation,function(e,t){return e!==t})).attr("class","border "+n+"-border").attr("d",path).style("stroke-width","0.1px");return!0}function progressive_load(e){var t=mapg.select("g#c4sa_areas");if(level==1){var n=d3.json(mapurl+"municipality?quantization=3000&filter[province]="+e.id),r=d3.json(apiurl+"2009/municipality/?all_results=true&province="+e.id);queue().defer(n.get).defer(r.get).await(function(e,t,n){n=n.results;update_map(t,n,"municipality")})}if(level==2){var i=d3.json(mapurl+"ward?quantization=3000&filter[municipality]="+e.id),s=d3.json(apiurl+"2009/ward/?all_results=true&municipality="+e.id);queue().defer(i.get).defer(s.get).await(function(n,r,i){t.selectAll("."+e.id).style("display","none");t.selectAll("."+e.properties.PROVINCE).style("display","none");i=i.results;update_map(r,i,"ward")})}}function hide_parents(e){var t=mapg.select("g#c4sa_areas");switch(level){case 1:return;case 2:d3.selectAll(".province").style("display","inherit");d3.selectAll(".municipality").style("display","inherit");d3.select("#"+e.properties.province).style("display","none");d3.select("#"+e.properties.municipality).style("display","none");return;case 3:var n=d3.select("#"+e.properties.municipality).style("display","none");d3.select("#"+n.data()[0].properties.province).style("display","none");return}}function zoomin(e){curElem=e;level=e.properties.level+1;level<3&&progressive_load(e);level>0&&d3.select("#c4sa_zoomout").style("display","inline");level==1&&d3.selectAll(".province").style("display","inherit");level==2&&d3.selectAll(".municipality").style("display","inherit");var t,n,r,i,s,o,u,a=path.centroid(e);t=a[0];n=a[1];var f=path.bounds(e);r=f[1][0]-f[0][0];i=f[1][1]-f[0][1];s=.8/Math.max(r/width,i/height);mapg.transition().duration(750).attr("transform","translate("+width/2+","+height/2+")scale("+s+")translate("+ -t+","+ -n+")").each("end",function(){hide_parents(e)});mapg.attr("class","level-"+level)}function zoomout(){if(level==1){mapg.transition().duration(750).attr("transform","translate(0,0)scale(1)");level=0;mapg.attr("class","level-"+level);d3.selectAll(".municipality").style("display","none");d3.selectAll(".ward").style("display","none");console.log(level);d3.selectAll(".province").style("display","inherit");d3.select("#c4sa_zoomout").style("display","none")}else if(level==2){el=d3.select("#"+curElem.properties.province);zoomin(el.data()[0])}else if(level==3){el=d3.select("#"+curElem.properties.municipality);zoomin(el.data()[0])}}function getNodePos(e){var t=d3.select("body").node();for(var n=0,r=0;e!=null&&e!=t;n+=e.offsetLeft||e.clientLeft,r+=e.offsetTop||e.clientTop,e=e.offsetParent||e.parentNode);return{x:n,y:r}}function calc_winners(e){var t=[],n={},r=0,i=0;for(var s in e)if(e[s]>r){r=e[s];n={party:s,vote_count:e[s]}}return n}function sort_votes(e){var t=[];for(party in e)t.push([party,e[party]]);t.sort(function(e,t){return t[1]-e[1]});return t.slice(0,3)}function move_overlay(){var e=[0,0];e=d3.mouse(svg.node());var t=d3.event.pageX-200,n=d3.event.pageY+20,r=d3.select("div#c4sa_overlay");r.style("display","block").style("top",n+"px").style("left",t+"px")}function hide_overlay(){var e=d3.select("div#c4sa_overlay");e.style("display","none")}function hovered(e){if(!hovering){hoverph.append("path").attr("d",d3.select(this).attr("d")).attr("id","c4sa_hoverobj");hovering=!0;var t="";e.properties.level==0?t=e.properties.province_name:e.properties.level==1?t=e.properties.municipality_name+", "+e.properties.province:t="Ward "+e.properties.ward_number+", "+e.properties.municipality_name;var n=e.properties.results,r=e.properties.winner;d3.select("#c4sa_hoverblurb").text(r.party+" "+Math.round(r.perc*100)+"%");d3.select("#c4sa_hovername").text(e.id);d3.select("#c4sa_demarcation_title").text(t);d3.select("#c4sa_section_24a_votes").text(num_format(e.properties.results.meta.section_24a_votes));d3.select("#c4sa_num_registered").text(num_format(e.properties.results.meta.num_registered));d3.select("#c4sa_special_votes").text(num_format(e.properties.results.meta.special_votes));d3.select("#c4sa_spoilt_votes").text(num_format(e.properties.results.meta.spoilt_votes));d3.select("#c4sa_total_votes").text(num_format(e.properties.results.meta.total_votes));var i=e.properties.results.meta.total_votes;d3.select("#c4sa_vote_results").html("");var s=d3.select("#c4sa_vote_results").selectAll("tr").data(sort_votes(e.properties.results.vote_count)),o=s.enter().append("tr").attr("class",function(e){return"party row-"+e[0].replace(/\s/g,"_").toLowerCase()});o.append("td").text(function(e){return e[0]});o.append("td").text(function(e){return num_format(e[1])});o.append("td").text(function(e){return perc_format(e[1]/i)})}}function unhovered(e){d3.select("#c4sa_hovername").text("");d3.select("#c4sa_hoverobj").remove();hovering=!1}function safe_id(e){return e.replace(/[^A-Za-z0-9]/g,"")}var Code4SA={};Code4SA.Framework=function(e,t,n){var r={bindToElementId:"code4sa",project:"test",apiKey:""},i=null,s=function(){i=t.getElementById(r.bindToElementId);Code4SA.template.render(i)};return{deploy:function(e){s();r.project=e;i.className+="code4sa_deploy";Code4SA.app.init()}}}(this,this.document);var apiurl="http://iec-v2.code4sa.org/national/",mapurl="http://maps.code4sa.org/political/",provinceurl=apiurl+"2009/province/",municipalurl=apiurl+"2009/municipality/?all_results=true",wardurl=apiurl+"2009/ward/?all_results=true",width=500,height=450,curCode="",curBallot="",curElem,history=[],num_format=d3.format(","),perc_format=d3.format(".2%"),projection=d3.geo.conicEqualArea().center([0,-28.5]).rotate([-24.5,0]).parallels([-25.5,-31.5]).scale(1800).translate([width/2,height/2]),path=d3.geo.path().projection(projection),svg=d3.select("div#c4sa_map_container").select("svg");svg.attr("viewBox","0 0 "+width+" "+(height+100)).attr("id","c4sa_svg");var mapg=svg.select("g#c4sa_map").on("mousemove",move_overlay).on("mouseout",hide_overlay),selph=mapg.select("g#c4sa_selph"),hoverph=mapg.select("g#c4sa_hoverph"),borderg=mapg.select("g#c4sa_borders"),province_job=d3.json(mapurl+"province?quantization=5000"),province_data_job=d3.json(provinceurl),municipal_data_job=d3.json(municipalurl),ward_data_job=d3.json(wardurl),level=0,levels=["province","municipality","ward"],levels_zoom=[1,4,15],wardscache={},linear_scale=d3.scale.linear().domain([.2,1]),colors={"AFRICAN NATIONAL CONGRESS":"#4575b4","DEMOCRATIC ALLIANCE":"#d73027","INKATHA FREEDOM PARTY":"#FF9400","INDEPENDENT DEMOCRATS":"#e0f3f8","CONGRESS OF THE PEOPLE":"#91bfdb","UNITED DEMOCRATIC MOVEMENT":"#fc8d59"};queue().defer(province_job.get).defer(province_data_job.get).await(function(e,t,n){n=n.results;update_map(t,n,"province")});d3.select("#c4sa_zoomout").on("click",zoomout);var hovering=!1,seats=d3.select("#c4sa_seats_container");d3.json(apiurl+"2009/",function(e,t){var n=[],r=0;for(party in t.results.vote_count){n.push({party:party,votes:t.results.vote_count[party]});r+=t.results.vote_count[party]}n.sort(function(e,t){console.log(e,t);return e.votes<t.votes?1:-1});var i=d3.select("#c4sa_seats_container").selectAll("div").data(n).enter().append("div").attr("class","party").attr("id",function(e){return safe_id(e.party)}).each(function(e){for(var t=0;t<Math.floor(e.votes/r*400);t++)d3.select("#"+safe_id(e.party)).append("div").attr("class","seat").style("background-color",function(e){return colors[e.party]})}).on("mousemove",function(e){var t=d3.select("#c4sa_seats_overlay");t.select("#c4sa_party").text(e.party);t.select("#c4sa_seats_votes").text(num_format(e.votes));t.select("#c4sa_seats_seats").text(Math.floor(e.votes/r*400));t.select("#c4sa_seats_percentage").text(perc_format(e.votes/r));t.style("display","block");t.style("top",d3.event.pageY+10+"px");t.style("left",d3.event.pageX-200+"px")}).on("mouseout",function(e){d3.select("#c4sa_seats_overlay").style("display","none")})});