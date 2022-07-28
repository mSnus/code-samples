<template>

<div class="coordinates">
	<div class="row coords">
			<div class="head"><b>Отправление</b></div>
			<city
			source ="citySrc"
			id ="50"
			value ="49"
			simpleMode = "no"
			></city>
	</div>

	<div class="row">
		<refpoints></refpoints>
	</div>

	<div class="row coords">
			<div class="head"><b>Назначение</b></div>
			<city
			source ="cityDst"
			id ="6"
			value ="5"
			simpleMode = "no"
			></city>
	</div>
</div>

</template>

<script>
import City from "./city.vue"; //компонент "Город"
import Refpoints from './refpoints.vue'


export default {
  components: {
	  City,
	  Refpoints,
	},

  data() {
	  	return {
			  unsubscribe: null
		}
    },

  computed: {
	},

	methods: {
		setupAllRpsForYmap(){
			let allRpData = {
				type: 'FeatureCollection',
				features: [
				]
			}


			this.$store.state.cityData.forEach((el, idx)=>{
				allRpData.features.push({
					type: 'Feature',
					properties: {
										title: el.name,
										id: el.id,
										value: idx,
										kv: el.kv
					},
					geometry: {
								type: 'Point',
								coordinates: [parseInt(el.coords.split(',')[0]), parseInt(el.coords.split(',')[1])]
					}
				});
			});

			let self = this;

			/************************************************
			* ЗАКИДЫВАЕМ КООРДИНАТЫ РЕПЕРНЫХ ТОЧЕК В YMAPS *
			************************************************/

			self.$store.mapRps = ymaps.geoQuery(allRpData); //!init object
			self.$store.mapRps.then(
				(result) => {

				},
				(error) => {
					console.error('allRpsYmap>> ymaps.geoQuery(allRpData) error', error)
				},
				(progres) => {
					console.warn('allRpsYmap>> ymaps.geoQuery(allRpData) progress', progres)
				},
			)

					/**************************
					* ЗАГРУЖАЕМ ЗАКРЫТЫЕ ЗОНЫ *
					**************************/

			let restrictedZonesYmap = ymaps.geoXml.load('http://test3.vinetsky.com/data/restricted-zone1.kml'); //!load KML data
			restrictedZonesYmap.then(
				(result) => {

					try {
// console.log('restrictedZonesYmap received', result)
						result.geoObjects.get(0).each(el => {
								el.options.set({strokeWidth: 1})
								el.options.set({type: 'zone'})
						})

						self.$store.mapRestrictedZones = result.geoObjects.get(0);
						self.$store.mapObj.geoObjects.add(self.$store.mapRestrictedZones);

					}catch(e) {
						console.error(e)
					}

				},
				(error) => {
					console.error('restrictedZonesYmap>> ymaps.geoXml(restricted-zone1) error', error)
				},
				(progres) => {
					console.warn('restrictedZonesYmap>> ymaps.geoXml(restricted-zone1) progress', progres)
				},
			)

			let moscowCenterYmap = ymaps.geoXml.load('http://test3.vinetsky.com/data/moscow_center.kml'); //!load KML data
			moscowCenterYmap.then(
				(result) => {

					try {
						result.geoObjects.get(0).each(el => {
								el.options.set({strokeWidth: 1})
						})

						self.$store.mapMoscowCenter = result.geoObjects.get(0);
						self.$store.mapMoscowCenter.options.set('preset','moscow_center')
						self.$store.mapObj.geoObjects.add(self.$store.mapMoscowCenter);


						//!tell the framework everything is fine
						self.$store.dispatch('componentLoaded', 'Coordinates')
					}catch(e) {
						console.error(e)
					}

				},
				(error) => {
					console.error('restrictedZonesYmap>> ymaps.geoXml(moscow_center) error', error)
				},
				(progres) => {
					console.warn('restrictedZonesYmap>> ymaps.geoXml(moscow_center) progress', progres)
				},
			)


		},
	},

	created() {
		let self = this;

		this.unsubscribe = this.$store.subscribeAction({
			after: (action, state) => {
				if (action.type === "componentLoaded"){
					if (self.$store.getters.componentReady('Coordinates')) {
						self.unsubscribe();
					} else if (self.$store.getters.componentReady('Ymaps') && self.$store.getters.componentReady('CityData')) {
						this.setupAllRpsForYmap();
					}
				}
			},
		});
	},

	mounted() {

	},


}
</script>
<style>
</style>
