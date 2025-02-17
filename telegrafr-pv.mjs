#!/usr/bin/env node

import axios from 'axios'
import * as mqtt from 'mqtt'

// Define the API endpoint
const apiUrl = 'http://192.168.22.59:8050/getOutputData';

// Define the MQTT broker URL
const mqttBrokerUrl = 'mqtt://192.168.22.5:1883'; // Replace with your MQTT broker URL

// Create an MQTT client
const client = mqtt.connect(mqttBrokerUrl);

// Function to fetch data from the API and publish to MQTT
async function fetchAndPublishData() {
    try {
        const response = await axios.get(apiUrl).catch((error) => {
            console.error('API request failed:', error.message);
            return undefined; // Return undefined if the request fails
        });

        // Check if the response is undefined or invalid
        if (!response || response.status !== 200) {
            console.error('Invalid or undefined response from API');
            return; // Exit the function if the response is invalid
        }
        if (response.status === 200) {
            const data = response.data;
            // console.log('Data fetched successfully:', JSON.stringify(data, null, 2));
            console.log('Data fetched successfully');

            // Extract the deviceId from the JSON data
            const deviceId = data.deviceId;

            // Construct the dynamic MQTT topic
            const mqttTopic = `muh/pv/${deviceId}/json`;

            // Publish the data to the MQTT topic
            client.publish(mqttTopic, JSON.stringify(data), (err) => {
                if (err) {
                    console.error('Failed to publish to MQTT:', err);
                } else {
                    console.log(`Data published to MQTT topic: ${mqttTopic}`);
                }
            });
        } else {
            console.error('Failed to fetch data. Status code:', response.status);
        }
    } catch (error) {
        console.error('An error occurred while fetching data:', error);
    }
}

// Handle MQTT connection events
client.on('connect', () => {
    console.log('Connected to MQTT broker');

    // Fetch and publish data immediately
    fetchAndPublishData();

    // Set up an interval to fetch and publish data every 3 seconds
    setInterval(fetchAndPublishData, 3000); // 3000 milliseconds = 3 seconds
});

client.on('error', (err) => {
    console.error('MQTT connection error:', err);
});

client.on('close', () => {
    console.log('MQTT connection closed');
});
