var app = angular.module('homeDirectives', []);

app.directive('d3expdonut', ['d3', function(d3) {
    return {
        restrict: 'EA',
        scope: {
            data: "=",
            label: "@",
            onClick: "&"
        },
        link: function(scope, iElement, iAttrs) {

            var width = 180,
                height = 180,
                radius = Math.min(width, height) / 2;

            var labelr = radius-25;

            var color = d3.scale.ordinal()
                .range(["#1ABC96", "#F78D1E", "#3498DB", "#FFBB00"]);

            var arc = d3.svg.arc()
                .outerRadius(radius- 10)
                .innerRadius(radius - 30);

            var pie = d3.layout.pie()
                .sort(null)
                .value(function(d) { return d.percent; });


            // Exploding displacement
            var arcOver = d3.svg.arc()
                .outerRadius(radius - 5)
                .innerRadius(radius- 25);

            var svg = d3.select(iElement[0])
                .append('svg')
                .attr("width", width)
                .attr("height", height)
                .append("g")
                .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

            scope.$watch('data', function(newVals, oldVals) {
                return scope.render(newVals);
            }, true);

            scope.render = function(data){

                if (data) {
                    console.log(data);

                    var g = svg.selectAll(".arc")
                        .data(pie(data))
                        .enter().append("g")
                        .attr("class", "arc");

                    g.append("text")
                        .attr("transform", function(d) {
                            return "translate(0,10)";
                        })
                        .attr("dy", ".5em")
                        .style("text-anchor", "middle")
                        .attr("class", "mainlabel");

                    g.append("text")
                        .attr("transform", function(d) {
                            return "translate(0,-15)";
                        })
                        .attr("dy", ".5em")
                        .style("text-anchor", "middle")
                        .attr("class", "percentlabel");

                    d3.select(".mainlabel")
                        .text('Ownership');
                    d3.select(".percentlabel")
                        .text('100%');

                    g.append("path")
                        .attr("d", arc)
                        .attr("transform", function(d) { return "translate(0,0)"; })
                        .style("fill", function(d , i) {
                            console.log(d);
                            console.log(i);
                            return color(d.data.percent); })
                        .on("mouseover", function(d) {

                            d3.select(this).transition()
                                .duration(200)
                                .attr("d", arcOver);

                            d3.select(".mainlabel")
                                .text(d.data.name);

                            d3.select('.percentlabel')
                                .text(d.data.percent.toFixed(2) + "%")
                                .style("fill", function(d, i) {
                                    console.log(d);
                                    console.log(i);
                                    return color(d.data.percent); });
                        })

                        .on("mouseout", function(d) {
                            d3.select(this).transition()
                                .duration(100)
                                .attr("d", arc);

                            d3.select(".mainlabel")
                                .text('Ownership');
                            d3.select(".percentlabel")
                                .text('100%')
                                .style("fill", "black");
                        });
                }

            };
        }
    };
}]);