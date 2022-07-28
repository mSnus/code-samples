import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Select from 'react-select';
import { Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import axios from "axios";


import '../../css/searchbox.css';

import { AppDispatch } from '@app/store';

//сервер Elastic
const SEARCH_SERVER = 'http://5.188.83.67:9200/'

const ADDR_LEVEL = {
	//регион
	REGION: 'region',

	//населённый пункт
	LOCALITY: 'address',

	//улица
	STREET: 'streets',

	//дом
	HOUSE: 'houses',

	//помещение
	APART: 'apartments',
}


export type TSearchPageProps = {
	objId?: string,
	cadNum?: string,
	address?: string,

	regionId?: string,
	localityId?: number,
	streetId?: number,
	houseId?: string,
	apartId?: string,

	regionName?: string,
	localityName?: string,
	streetName?: string,
	houseName?: string,
	apartName?: string,

	localityResults?: [],
	streetResults?: [],
	houseResults?: [],
	apartResults?: [],

	lat?: string,
	lng?: string,

	cadCost?: string,
	area?: string,
	floors?: string,
}

interface ISearchData {
	name: string,
	id: number,
	results?: Array<any>,
	superRegion?: boolean,
}

interface ICadData {
	cadNum: string,
	cadCost: number,
	area: number,
	floors: number,
}

interface ICoords {
	lat: string,
	lng: string,
}

interface IFinalResult {
	region: ISearchData,
	address: ISearchData,
	streets: ISearchData,
	houses?: ISearchData,
	apartments?: ISearchData,
	cadData?: ICadData,
	coords?: ICoords,
}

interface ISearchPageProps {
	initData?: TSearchPageProps | undefined,
	confirm: (
		data: TSearchPageProps
	) => React.MouseEventHandler<any> | undefined,
	onClose: () => void;
}

interface ISelectOption {
	value: string,
	label: string,
}

interface IElasticResults {

}

let loadingBypass = false;


const SearchPage: React.FC<ISearchPageProps> = ({ initData, confirm, onClose }) => {

	/**
	 * Загрузка начальных данных
	 */
	const user = useSelector((state) => state.profile.user);

	//загружаем список регионов
	const regions = useSelector((state) => state.regions.regions);
	//typeof window !== undefined ? JSON.parse(window.localStorage.getItem('regions')) : [];


	loadingBypass = true

	const initRegion = (initData?.regionId > 0)
		? regions.filter(el => el.value == initData?.regionId)[0]
		: regions.filter(el => el.value == user?.home_region)[0]


	const initLocalityId = (initData?.localityId > 0) ? initData.localityId : -1
	const initLocalityName = initData?.localityName ?? ''
	const initLocalityRes = (initData?.localityResults) ? initData.localityResults : []

	const initStreetId = (initData?.streetId > 0) ? initData.streetId : -1
	const initStreetName = initData?.streetName ?? ''
	const initStreetRes = (initData?.streetResults) ? initData.streetResults : []

	const initHouseRes = (initData?.houseResults) ? initData.houseResults : []
	const initHouseOptions = initHouseRes.map((el, idx) => ({ value: idx, label: el._source.name }))

	const initApartId = (initData?.apartId > 0) ? initData.apartId : -1
	const initApartRes = (initData?.apartResults) ? initData.apartResults : []
	const initApartOptions = initApartRes.map((el, idx) => ({ value: idx, label: el._source.name }))



	// const initSearchError = (initRegion?.value > 0) ? false : 'Введите слова для поиска'

	const [finalChoice, setFinalChoice] = useState<IFinalResult>({
		region: { name: initRegion.label, id: parseInt(initRegion.value)},
		address: { name: initLocalityName, id: initLocalityId, results:  initLocalityRes},
		streets: { name: initStreetName, id: initStreetId, results: initStreetRes },
		houses: { name: '', id: -1, results: initHouseRes },
		apartments: {name: '', id: -1,  results: initApartRes},
		cadData: {cadNum: '', cadCost: 0, area: 0, floors: 0},
		coords: {lat: '57', lng: '32'}
	});

	const [houseOptions, setHouseOptions] = useState(initHouseOptions);

	const [apartResults, setApartResults] = useState(initApartRes);
	const [apartOptions, setApartOptions] = useState(initApartOptions);


	const [finalResult, setFinalResult] = useState<TSearchPageProps>({});
	// const [searchError, setSearchError] = useState<string | boolean>(initSearchError);


	const dispatch = useDispatch<AppDispatch>();

/*
	useEffect(() => {
		if (localityId > -1 && !loadingBypass) doSearch(ADDR_LEVEL.LOCALITY)
	}, [localityId]); */

	const superRegions = [
		{ id: 77, parentobjid: '77', name: 'г. Москва', level: '5', objectid: 1405113 },
		{ id: 78, parentobjid: '78', name: 'г. Санкт-Петербург', level: '5', objectid: 1414662 },
	];

	const handleRegionSelect = (selectedOption: ISelectOption) => {
		let superRegion = superRegions.filter(el => el.id.toString() == selectedOption.value)
		const clear: ISearchData = { id: -1, name: '', results: [] }

		if (superRegion.length > 0) {
			setFinalChoice({
				...finalChoice,
				region: { id: parseInt(selectedOption.value), name: selectedOption.label, superRegion: true },
				address: { id: superRegion[0].objectid, name: superRegion[0].name },
				streets: clear, houses: clear, apartments: clear
			})

		} else {
			setFinalUserChoice({ id: parseInt(selectedOption.value), name: selectedOption.label, superRegion: false }, ADDR_LEVEL.REGION)
		}
	}

	/**
	 * в опциях хранится только порядковый номер и название пункта,
	 * поэтому мы берём полные данные из загруженного списка домов
	 * по этому порядковому номеру
	 *
	 * пример получаемых houseData:
	 * {parentobjid: '824588', name: 'стр. 2', cadnum: '50:28:0060208:132', objectid: '10804913'}
	 *
	 * @param selectedOption
	 * @returns
	 */
	const handleHouseSelect = async (selectedOption: ISelectOption) => {

		let houseData = finalChoice.houses.results[selectedOption.value]._source;
		console.log("handleHouseSelect: houseData>>>", houseData)

		setFinalUserChoice({ id: houseData.objectid, name: houseData.name}, ADDR_LEVEL.HOUSE)

		let fullAddress = `${finalChoice.region.name}, ${finalChoice.address.name}, ${finalChoice.streets.name}, ${houseData.name}`
		let coords = await axios.post(`https://backapp.pf-invest.com:8443/api/geocode`, { address: fullAddress, method: 'yandex' })


		console.log('handleHouseSelect>> finalChoice', finalChoice)
		setFinalResult({
			...finalResult,
			cadNum: houseData.cadnum,
			objId: houseData.objectid,
			address: fullAddress,
			lat: coords.data.lat,
			lng: coords.data.lng,

			regionId: finalChoice.region.id,
			localityId: finalChoice.address.id,
			streetId: finalChoice.streets.id,
			houseId: houseData.objectid,

			regionName: finalChoice.region.name,
			localityName: finalChoice.address.name,
			streetName: finalChoice.streets.id,
			houseName: houseData.name,

			localityResults: finalChoice.address.results,
			streetResults: finalChoice.streets.results,
			houseResults: finalChoice.houses.results,

			cadCost: houseData.cad_cost,
			area: houseData.area_value,
			floors: houseData.floors,
		})

				//сразу при выборе дома подгружаем и ищем все квартиры в этом доме
				let hits = await doSearch(ADDR_LEVEL.APART, houseData.objectid)

				let options = []
				let results = []
				if (hits && hits.error == '' && hits.result && Array.isArray(hits.result)){
					options = hits.result.map((el, idx) => ({ value: idx, label: el._source.name }))
					results = hits.result
				}

				setApartOptions(options)
				setFinalUserChoice({ results: results }, ADDR_LEVEL.APART)
				console.log('Filling aparts data>>', hits)

		console.log('handleHouseSelect>>> finalResult', finalResult)

		return finalResult
	}

	const handleApartSelect = async (selectedOption) => {

		let apartData = apartResults[selectedOption.value]._source;
		console.log("handleApartSelect: apartData>>>", apartData)

		setFinalUserChoice({ id: apartData.objectid, name: apartData.name }, ADDR_LEVEL.APART)

		let fullAddress = `${finalChoice.region.name}, ${finalChoice.address.name}, ${finalChoice.streets.name}, ${apartData.name}`
		let coords = await axios.post(`https://backapp.pf-invest.com:8443/api/geocode`, { address: fullAddress, method: 'yandex' })


		console.log('handleApartSelect>> finalChoice', finalChoice)
		setFinalResult({
			...finalResult,
			cadNum: apartData.cadnum,
			objId: apartData.objectid,
			address: fullAddress,
			lat: coords.data.lat,
			lng: coords.data.lng,

			regionId: finalChoice.region.id,
			localityId: finalChoice.address.id,
			streetId: finalChoice.streets.id,
			apartId: apartData.objectid,

			regionName: finalChoice.region.name,
			localityName: finalChoice.address.name,
			streetName: finalChoice.streets.id,
			apartName: apartData.name,

			localityResults: finalChoice.address.results,
			streetResults: finalChoice.streets.results,
			apartResults: apartResults,

			cadCost: apartData.cad_cost,
			area: apartData.area_value,
			floors: apartData.floors,
		})

		console.log('handleApartSelect>>> finalResult', finalResult)

		return finalResult
	}


	/**
	 * Ищет по подстроке через Elastic Fuzzy Search
	 * @param {*} level
	 * @returns
	 */
	const doSearch = async (level: string, term: string) => {
		if (loadingBypass) {
			console.log('bypassing search because of bypass flag')
			return
		}

		// const term = document.getElementById('term_' + level)?.value ?? ''
		if (!term || term.toString().trim() == '' && level != ADDR_LEVEL.HOUSE) {

			console.log(`doSearch >> No term to search, level: ${level}`)
			return false
		}

		const localityName = finalChoice.address.name
		console.log(`Searching for '${term}' on lvl '${level}' in '${localityName}'`, term, level, localityName)

		console.log('Choice:', finalChoice)
		let parentId = -1;
		let regionId = finalChoice.region.id
		let request = {};
		let url = ''

		// собираем запрос request в зависимости от уровня поиска
		switch (level) {
			case ADDR_LEVEL.REGION:
				request = {
					"size": 3,
					"query": {
						"match": {
							"name": {
								"query": term,
								"fuzziness": "AUTO",
								"prefix_length": 1
							}
						}
					}
				}
				break;
			case ADDR_LEVEL.LOCALITY:
				parentId = regionId
				url = 'address_' + regionId + '/_search'
				request = {
					// "explain": true,
					// "profile": true,
					"size": 3,
					"query": {
						"function_score": {
							"functions": [
								{
									"field_value_factor": {
										"field": "level",
										"factor": 5,
										"modifier": "sqrt",
										"missing": 0.1
									}
								}
							],
							"query": {
								"bool": {
									"must": {
										"match": {
											"name": {
												"query": term,
												"fuzziness": "AUTO",
												"prefix_length": 1
											}
										}
									},

									"filter": {
										"match": {
											"parentobjid": parentId
										}
									}
								}
							},
							"score_mode": "multiply"
						}
					}
				}
				break;
			case ADDR_LEVEL.STREET:
				parentId = finalChoice.address.id
				url = 'streets_' + regionId + '/_search'
				request = {
					"size": 5,
					"query": {
						"bool": {
							"must": {
								"match": {
									"name": {
										"query": term,
										"fuzziness": "AUTO",
										"prefix_length": 1
									}
								}
							},

							"filter": {
								"term": {
									"parents": parentId
								}
							}
						}
					}
				}
				break;

			case ADDR_LEVEL.HOUSE:
				url = 'houses_' + regionId + '/_search'
				request = {
					"size": 200,
					"query": {
						"bool": {
							"filter": {
								"match": {
									"parentobjid": term
								}
							}
						}
					}
				}
				break;
			case ADDR_LEVEL.APART:
				url = 'apartments_' + regionId + '/_search'
				request = {
					"size": 200,
					"query": {
						"bool": {
							"filter": {
								"match": {
									"parentobjid": term
								}
							}
						}
					}
				}
				break;
			default:
				console.error('doSearch() unknown level:' + level)
				break;
		}

		const requestData = JSON.stringify(request)
		let searchUrl = `${SEARCH_SERVER}${url}`
		console.log('requestData>>',requestData, url)

		try {

			const response = await fetch(searchUrl, {
				headers: { accept: "application/json", 'content-type': 'application/json' },
				// new Headers({'content-type': 'application/json'})
				method: 'POST',
				// mode: 'no-cors', // no-cors, *cors, same-origin
				cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
				// credentials: 'include', // include, *same-origin, omit
				body: requestData
			})

			if (!response.ok) {
				// setResults([], level)
				console.error(response)
				console.error(response.statusText)//throw new Error(response.statusText)

				return {result: [], error: 'Ошибка на сервере при поиске'}
			} else {
				const jsonResult = await response.json()
				const hits = jsonResult.hits.hits
				// console.warn(hits)
				// console.warn(typeof jsonResult)
				// console.warn(Array.isArray(jsonResult))

				/* if (!returnResults) {
					setResults([...hits], level)
				} */

				return {result: [...hits], error: false}
			}
		} catch (error) {
				return {result: [], error: 'Ошибка связи с сервером поиска'}
		}



	}


	/**
	 * Реакция на выбор конкретного результата поиска пользователем
	 * @param {*} id
	 * @param {*} name
	 * @param {*} level
	 */
	const setFinalUserChoice = (choice: ISearchData, level) => {
		console.warn('setFinalUserChoice: (choice, level)', choice, level)
		const clear: ISearchData = { id: -1, name: '', results: [] }

		switch (level) {
			case ADDR_LEVEL.REGION:
				setFinalChoice({region: choice, address: clear, streets: clear, houses: clear, apartments: clear})
				break;
			case ADDR_LEVEL.LOCALITY:
				setFinalChoice({...finalChoice, address: choice, streets: clear, houses: clear, apartments: clear})
				break;
			case ADDR_LEVEL.STREET:
				setFinalChoice({ ...finalChoice, streets: choice, houses: clear, apartments: clear })
				break;
			case ADDR_LEVEL.HOUSE:
				setFinalChoice({...finalChoice, houses: choice, apartments: clear})
				break;
			case ADDR_LEVEL.APART:
				setFinalChoice({...finalChoice, apartments: choice})
				break;
			default:
				throw Error('setResults() unknown level:' + level)
		}
	}


	/**
	 * Выводит список результатов, полученных при поиске,
	 * в виде вариантов выбора
	 *
	 * @param level - уровень поиска
	 * @param data - результаты поиска в виде {id, name, results<SearchResults>}
	 * @param onChooseResult - обработчик выбра варианта
	 * @returns
	 */
	const SearchResults = ({ level, data, onChooseResult }) => {

		const curChoice =  {id: data.id, name: data.name}
		const curObjectId = curChoice.id
		const curObjectName = curChoice.name
		const curResults = data.results

		return (
			<div className='search-results-wrapper'>
					<div className='results-ok'>
						<div className='search-results' style={{ display: ((curObjectId > 0) ? "none" : "block") }}>
							{curResults.length > 0 ?
								<div>
									{curResults.map(el => {
										return (
											<div key={el._id} className='search-result' onClick={() => { onChooseResult(el._id, el._source.name) }}>
												{el._source.name}
												{(level == ADDR_LEVEL.STREET && el._source.parent_address != '') ? <span className="search-hint">{'(' + el._source.parent_address + ')'}</span> : ''}
											</div>
										)
									})
									}
								</div>
								:
								<div className='search-notfound'>
									Ничего не найдено
								</div>
							}
						</div>
						{curObjectId > 0 &&
							<div className='search-result selected-result' onClick={() => { onChooseResult(-1, '') }}>
								{curObjectName}  <span className='selected-result__close'><img src={"/icons/close-yellow.svg"} /></span>
								{/* <span className="search-hint">({curObjectId})</span> */}
							</div>
						}
					</div>
			</div>
		)
	}


	interface ISearchBoxProps {
		addrLevel: string,
		title: string,
		initData?: ISearchData,
		parentId?: number,
	}

	const SearchBox2 : React.FC<ISearchBoxProps> = ({ addrLevel, title, initData, parentId }, ref) => {
		const [propertyName, setPropertyName] = useState(initData?.name ?? '');
		const [propertyId, setPropertyId] = useState(initData?.id ?? -1);
		const [propertyResults, setPropertyResults] = useState(initData?.results ?? []);
		const [searchResultError, setSearchResultError] = useState('');


		const propertyOptions = (Array.isArray(propertyResults)) ? propertyResults.map((el, idx) => ({ value: idx, label: el._source.name })) : []


		const searchByTerm = async (e) => {
			let term = e.target.value
			console.warn('Searching for ', term)


			let searchResult =  await doSearch(addrLevel, term)

			if (searchResult.error === false) {
				console.warn(searchResult.result)
				setPropertyResults(searchResult.result)
				setSearchResultError('')
			} else {
				console.warn(searchResult.error)
				setPropertyResults([])
				setSearchResultError(searchResult.error)
			}
		}

		const chooseResult = async (id, name) => {
			console.log('chooseResult>>',  id, name)
			setPropertyId(id)
			setPropertyName(name)
			setFinalUserChoice({ id: id, name: name }, addrLevel)

			if (addrLevel == ADDR_LEVEL.STREET) {
				//сразу при выборе улицы подгружаем и ищем все дома на этой улице
				let hits = await doSearch(ADDR_LEVEL.HOUSE, id)

				let options = []
				let results = []
				if (hits && hits.error == '' && hits.result && Array.isArray(hits.result)){
					options = hits.result.map((el, idx) => ({ value: idx, label: el._source.name }))
					results = hits.result
				}

				setHouseOptions(options)
				setFinalUserChoice({ id: -1, name: '', results: results }, ADDR_LEVEL.HOUSE)
				console.log('Filling houses data>>', hits)
			}
		}

		const displayStyle = (propertyId > 0) ? {
			visibility: 'hidden',
			height: '1px',
			margin: '0px',
			padding: '0px',
			overflow: 'hidden',
		} : {
			visibility: 'visible',
			height: 'auto',
			margin: 'auto',
			padding: '8px',
			overflow: 'hidden',
		}

		return (
			<div className='addr-search-box'  >
				<div className='level-title'>
					{title}
				</div>
				{searchResultError === '' ? '' :
					<div className='search-error'>{ searchResultError }</div>
				}
				<div>

					<input
						style={ displayStyle }
						type="search"
						className='term'
						id={'term_' + addrLevel}
						onInput={searchByTerm}

					/>

					<SearchResults
						level={addrLevel}
						data={{ id: propertyId, name: propertyName, results: propertyResults }}
						onChooseResult={chooseResult}
					/>

				</div>

			</div>
		)
	}

	const SearchBoxLocality= () => {
		return (
			<SearchBox2 addrLevel={ADDR_LEVEL.LOCALITY}
				title="Населённый пункт"
				initData={{ id: finalChoice.address.id, name: finalChoice.address.name }}
			>
			</SearchBox2>
		)
	}

	const SearchBoxStreet= () => {
		return (
			<SearchBox2 addrLevel={ADDR_LEVEL.STREET}
				title="Улица"
				initData={{ id: finalChoice.streets.id, name: finalChoice.streets.name }}
			>
			</SearchBox2>
		)
	}


	const selectStyles = {
		control: base => ({
			...base,
			fontSize: "1.5rem",
			border: "solid 3px #ffec41",
			marginTop: "2rem",
			marginLeft: "auto",
			marginRight: "auto",
		}),
		menu: base => ({
			...base,
			fontSize: "1.3rem"
		})
	};

	const noOptions = (input) => {
		// setHouseId(-1)
		return "не найдено: " + input.inputValue
	};


	const selectedCategory = useSelector(
		(state: TRootState) => state.properties.rentOut.category_id
	 );

	loadingBypass = false



	return (
			<div className="searchbox-main">
				<div className='dialog-close' onClick={onClose}>
					<CloseIcon />
				</div>
				<div><Select
					options={regions}
					onChange={handleRegionSelect}
					className={'termselect'}
					styles={selectStyles}
					placeholder="Выберите..."
					noOptionsMessage={noOptions}
					// value={{ value: initRegion?.value ?? '', label: initRegion?.label ?? '' }}
					defaultValue={initRegion}
				/></div>

			{<SearchBoxLocality />}

				{(finalChoice.address.id > -1) ? <SearchBoxStreet /> : ''}

				{(finalChoice.streets.id> -1) ?
					<Select
						options={houseOptions}
						onChange={handleHouseSelect}
						className={'termselect'}
						styles={selectStyles}
						placeholder="Выберите..."
						noOptionsMessage={noOptions}
					/>
					: ''}
				{(finalChoice.houses.id > -1) ? <div className='searchbox-final-result'>

					<Button onClick={confirm(finalResult)} variant="contained" size="large">
						Выбрать {finalChoice.houses.name}
					</Button>

					<Select
						options={apartOptions}
						onChange={handleApartSelect}
						className={'termselect'}
						styles={selectStyles}
						placeholder="Выберите..."
						noOptionsMessage={noOptions}
					/>
				</div>
					: ''}
			</div>
	)
}


export default SearchPage
